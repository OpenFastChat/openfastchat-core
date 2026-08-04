package middleware

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/openfastchat/openfastchat-core/store"

	"github.com/google/uuid"
)

// GuestProvisioner creates a guest user (with thread and default flow) and
// returns its ID + synthetic email. Injected so middleware need not import the
// handler package.
type GuestProvisioner func(ctx context.Context, queries *store.Queries) (uuid.UUID, string, error)

// GuestGate is an optional pre-provision policy check (captcha, per-IP caps,
// global capacity). It returns true to allow provisioning; on rejection it
// writes the HTTP response itself and returns false. A nil gate always allows —
// the self-host default.
type GuestGate func(w http.ResponseWriter, r *http.Request) bool

// Auth requires a valid session cookie, returning 401 if missing or invalid.
// Use for routes that must not auto-provision.
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, email, ok := parseSessionCookie(r, jwtSecret)
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(withUser(r.Context(), uid, email)))
		})
	}
}

// EnsureUser attaches a user to the request context. If the cookie is missing
// or invalid, gate (if any) runs first, then a guest user is provisioned and
// its session cookie set. onProvision (nil-safe) reports the "created" outcome
// for metrics. Use for routes that allow anonymous access.
func EnsureUser(
	jwtSecret string,
	queries *store.Queries,
	provisionGuest GuestProvisioner,
	gate GuestGate,
	onProvision func(outcome string),
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, email, ok := parseSessionCookie(r, jwtSecret)
			if !ok {
				if gate != nil && !gate(w, r) {
					return
				}
				newID, newEmail, err := provisionGuest(r.Context(), queries)
				if err != nil {
					slog.Error("provision guest", "err", err)
					http.Error(w, "internal error", http.StatusInternalServerError)
					return
				}
				if err := SetSessionCookie(w, jwtSecret, newID, newEmail); err != nil {
					slog.Error("set session cookie", "err", err)
					http.Error(w, "internal error", http.StatusInternalServerError)
					return
				}
				if onProvision != nil {
					onProvision("created")
				}
				uid = newID.String()
				email = newEmail
			}
			next.ServeHTTP(w, r.WithContext(withUser(r.Context(), uid, email)))
		})
	}
}

// OptionalUser attaches a user to the request context iff the session cookie is
// valid. Never provisions. Use for read endpoints that serve a useful response
// to an unauthenticated client (e.g. /api/me returning anon).
func OptionalUser(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, email, ok := parseSessionCookie(r, jwtSecret)
			if ok {
				r = r.WithContext(withUser(r.Context(), uid, email))
			}
			next.ServeHTTP(w, r)
		})
	}
}
