package middleware

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

const anonCookieName = "ofc_anon"

// IPLimiter gates guest provisioning. Each browser (identified by a signed
// ofc_anon cookie, minted on first contact) gets its own per-window budget so
// users behind one proxy IP don't starve each other; a higher per-IP ceiling
// backstops cookie-rotation floods.
type IPLimiter struct {
	window           time.Duration
	perBrowser       atomic.Int32
	perIP            atomic.Int32
	store            *slidingWindow
	trustForwardedIP bool
	secret           string
}

// NewIPLimiter builds a guest-provisioning limiter over the given window.
func NewIPLimiter(
	window time.Duration, perBrowser, perIP int,
	trustForwardedIP bool, secret string,
) *IPLimiter {
	l := &IPLimiter{
		window:           window,
		store:            newSlidingWindow(window),
		trustForwardedIP: trustForwardedIP,
		secret:           secret,
	}
	l.perBrowser.Store(int32(perBrowser))
	l.perIP.Store(int32(perIP))
	return l
}

// SetLimits updates the per-browser and per-IP caps at runtime. Non-positive
// values are ignored (they'd deny every request).
func (l *IPLimiter) SetLimits(perBrowser, perIP int) {
	if perBrowser > 0 {
		l.perBrowser.Store(int32(perBrowser))
	}
	if perIP > 0 {
		l.perIP.Store(int32(perIP))
	}
}

// Allow reports whether a new guest may be provisioned for this request,
// minting the browser cookie when absent. Both the per-browser and per-IP
// windows must have headroom; the returned reason ("browser"/"ip") names the
// exhausted one when denied.
func (l *IPLimiter) Allow(w http.ResponseWriter, r *http.Request) (ok bool, reason string) {
	id := l.anonID(w, r)
	if !l.store.allow("gb:"+id, int(l.perBrowser.Load()), l.window) {
		return false, "browser"
	}
	ip := ClientIP(r, l.trustForwardedIP)
	if !l.store.allow("gip:"+ip, int(l.perIP.Load()), l.window) {
		return false, "ip"
	}
	return true, ""
}

// anonID returns the caller's signed browser id, reading it from the ofc_anon
// cookie or minting a fresh one (set on the response).
func (l *IPLimiter) anonID(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(anonCookieName); err == nil {
		if id, ok := l.parseAnonCookie(c.Value); ok {
			return id
		}
	}
	id := newAnonID()
	http.SetCookie(w, AuthCookie(anonCookieName, id+"."+l.signAnonID(id), 365*24*3600))
	return id
}

func (l *IPLimiter) parseAnonCookie(value string) (string, bool) {
	id, sig, found := strings.Cut(value, ".")
	if !found || id == "" {
		return "", false
	}
	if !hmac.Equal([]byte(sig), []byte(l.signAnonID(id))) {
		return "", false
	}
	return id, true
}

func (l *IPLimiter) signAnonID(id string) string {
	mac := hmac.New(sha256.New, []byte(l.secret))
	mac.Write([]byte(id))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func newAnonID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
