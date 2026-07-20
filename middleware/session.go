package middleware

import (
	"context"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const (
	userIDKey    contextKey = "user_id"
	userEmailKey contextKey = "user_email"
)

// SessionExpiryDays is the lifetime of a signed session cookie. Wrappers may
// override it at startup.
var SessionExpiryDays = 30

// ParseSessionCookie reads and verifies the session cookie. Returns
// (id, email, true) on success. Used outside middleware (e.g. OAuth callback)
// to read the current user without forcing auto-provision.
func ParseSessionCookie(r *http.Request, jwtSecret string) (id, email string, ok bool) {
	return parseSessionCookie(r, jwtSecret)
}

func parseSessionCookie(r *http.Request, jwtSecret string) (id, email string, ok bool) {
	cookie, err := r.Cookie("session")
	if err != nil {
		return "", "", false
	}
	token, err := jwt.Parse(cookie.Value, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return "", "", false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", "", false
	}
	id, _ = claims["sub"].(string)
	email, _ = claims["email"].(string)
	if id == "" {
		return "", "", false
	}
	return id, email, true
}

func withUser(ctx context.Context, id, email string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, id)
	ctx = context.WithValue(ctx, userEmailKey, email)
	captureUserID(ctx, id)
	return ctx
}

// UserIDFromContext returns the request's user id, if any.
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey).(string)
	return id, ok
}

// UserFromContext returns the request's user id and email, if any.
func UserFromContext(ctx context.Context) (id, email string, ok bool) {
	id, ok = ctx.Value(userIDKey).(string)
	email, _ = ctx.Value(userEmailKey).(string)
	return id, email, ok
}

// cookieSecure is the Secure attribute stamped on every auth cookie. Defaults
// to true (production); SetCookieSecure(false) is called at startup for
// plain-HTTP deploys, where browsers silently drop Secure cookies — which
// would mint a fresh guest per request and nullify the prompt cap.
var cookieSecure = true

// SetCookieSecure configures the Secure attribute for all auth cookies.
func SetCookieSecure(secure bool) { cookieSecure = secure }

// AuthCookie builds a cookie with the standard auth attributes so the Secure
// flag is consistent across session, anon-id and oauth-state.
func AuthCookie(name, value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		HttpOnly: true,
		Secure:   cookieSecure,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		MaxAge:   maxAge,
	}
}

// SetSessionCookie writes the signed session cookie. Shared by EnsureUser
// auto-provisioning and the wrapper login flows.
func SetSessionCookie(w http.ResponseWriter, jwtSecret string, userID uuid.UUID, email string) error {
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   userID.String(),
		"email": email,
		"exp":   time.Now().Add(time.Duration(SessionExpiryDays) * 24 * time.Hour).Unix(),
	}).SignedString([]byte(jwtSecret))
	if err != nil {
		return err
	}
	http.SetCookie(w, AuthCookie("session", token, SessionExpiryDays*24*3600))
	return nil
}

// ClientIP extracts the requester's IP. With trustForwardedIP set it reads the
// RIGHT-most X-Forwarded-For entry — the IP a single trusted proxy (Caddy)
// appends as the real peer, which a client cannot forge (any injected value
// lands to the left of the append).
func ClientIP(r *http.Request, trustForwardedIP bool) string {
	if trustForwardedIP {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if idx := strings.LastIndexByte(xff, ','); idx >= 0 {
				return strings.TrimSpace(xff[idx+1:])
			}
			return strings.TrimSpace(xff)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
