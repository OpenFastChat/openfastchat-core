package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

// GuestEmailSuffix must match the suffix ProvisionGuestUser writes: the limiter
// tiers on it instead of reading the DB.
const GuestEmailSuffix = "@guest.local"

type tier int

const (
	tierAnon tier = iota
	tierGuest
	tierUser
)

// RateLimiter enforces per-minute request caps, tiered anon/guest/user.
type RateLimiter struct {
	store            *slidingWindow
	trustForwardedIP bool
	readGuest        atomic.Int32
	writeGuest       atomic.Int32
	readUser         atomic.Int32
	writeUser        atomic.Int32
	anonIPCeiling    atomic.Int32
	onReject         func(tier, kind string)
}

// NewRateLimiter builds a limiter. onReject (nil-safe) is called with the tier
// and kind ("read"/"write") labels whenever a request is throttled, letting a
// wrapper record metrics without coupling core to a metrics backend.
func NewRateLimiter(trustForwardedIP bool, onReject func(tier, kind string)) *RateLimiter {
	return &RateLimiter{
		store:            newSlidingWindow(time.Minute),
		trustForwardedIP: trustForwardedIP,
		onReject:         onReject,
	}
}

// Limits carries every tunable per-minute cap. Signed-in users and guests are
// tiered read-vs-write by user_id; anonymous reads get a single coarse per-IP
// ceiling as a flood backstop.
type Limits struct {
	ReadGuest, WriteGuest int32
	ReadUser, WriteUser   int32
	AnonIPCeiling         int32
}

// SetLimits updates the caps at runtime.
func (rl *RateLimiter) SetLimits(l Limits) {
	rl.readGuest.Store(l.ReadGuest)
	rl.writeGuest.Store(l.WriteGuest)
	rl.readUser.Store(l.ReadUser)
	rl.writeUser.Store(l.WriteUser)
	rl.anonIPCeiling.Store(l.AnonIPCeiling)
}

// Middleware throttles requests by tier. With all caps at zero (the self-host
// default) every request is allowed.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, t := rl.keyAndTier(r)
		if !rl.store.allow(key, int(rl.limit(t, isWriteMethod(r.Method))), time.Minute) {
			rl.reject(w, t, kindLabel(isWriteMethod(r.Method)))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) reject(w http.ResponseWriter, t tier, kind string) {
	if rl.onReject != nil {
		rl.onReject(tierLabel(t), kind)
	}
	w.Header().Set("Retry-After", "60")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "rate_limited",
		"message": "You're sending requests too quickly. Please slow down.",
	})
}

func (rl *RateLimiter) keyAndTier(r *http.Request) (key string, t tier) {
	uid, email, ok := UserFromContext(r.Context())
	if !ok || uid == "" {
		return "anonip:" + ClientIP(r, rl.trustForwardedIP), tierAnon
	}
	if strings.HasSuffix(email, GuestEmailSuffix) {
		return "u:" + uid, tierGuest
	}
	return "u:" + uid, tierUser
}

func (rl *RateLimiter) limit(t tier, write bool) int32 {
	switch t {
	case tierAnon:
		return rl.anonIPCeiling.Load()
	case tierGuest:
		if write {
			return rl.writeGuest.Load()
		}
		return rl.readGuest.Load()
	default:
		if write {
			return rl.writeUser.Load()
		}
		return rl.readUser.Load()
	}
}

func tierLabel(t tier) string {
	switch t {
	case tierAnon:
		return "anonymous"
	case tierGuest:
		return "guest"
	default:
		return "user"
	}
}

func kindLabel(write bool) string {
	if write {
		return "write"
	}
	return "read"
}

func isWriteMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}
