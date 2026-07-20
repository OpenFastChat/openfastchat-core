package handler

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/1-Bart-1/openfastchat-core/middleware"
	"github.com/1-Bart-1/openfastchat-core/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// TimeFormat is the wire format for all timestamps returned by the API.
const TimeFormat = time.RFC3339

// RequireUser returns the authenticated user's id, or an error if absent.
func RequireUser(r *http.Request) (uuid.UUID, error) {
	userID, _, ok := middleware.UserFromContext(r.Context())
	if !ok {
		return uuid.UUID{}, fmt.Errorf("no user")
	}
	return uuid.Parse(userID)
}

// RequireUserOr401 returns the authenticated user or writes a 401 and false.
func RequireUserOr401(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	uid, err := RequireUser(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return uuid.UUID{}, false
	}
	return uid, true
}

// OptionalUserUUID returns the authenticated user id if present.
func OptionalUserUUID(r *http.Request) (uuid.UUID, bool) {
	uid, err := RequireUser(r)
	if err != nil {
		return uuid.UUID{}, false
	}
	return uid, true
}

// ParseURLParam parses a chi URL parameter as a UUID.
func ParseURLParam(r *http.Request, param string) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, param))
}

// ParseUUIDParamOr400 parses a chi URL parameter as a UUID or writes a 400.
func ParseUUIDParamOr400(w http.ResponseWriter, r *http.Request, param string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, param))
	if err != nil {
		http.Error(w, "invalid "+param, http.StatusBadRequest)
		return uuid.UUID{}, false
	}
	return id, true
}

// RequireThreadAccess returns an error unless the thread belongs to the user.
func RequireThreadAccess(r *http.Request, queries *store.Queries, threadID, userID uuid.UUID) error {
	_, err := queries.GetThreadByID(r.Context(), store.GetThreadByIDParams{
		ID: threadID, UserID: userID,
	})
	return err
}

// HashEmail returns the lowercase-email SHA-256 hex digest used for GDPR-safe
// access/payment logging.
func HashEmail(email string) string {
	h := sha256.Sum256([]byte(strings.ToLower(email)))
	return fmt.Sprintf("%x", h)
}

// WriteJSON encodes v as a JSON response with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write json", "err", err)
	}
}

// WriteServerError logs err with logMsg context and returns a generic 500.
func WriteServerError(w http.ResponseWriter, logMsg string, err error) {
	slog.Error(logMsg, "err", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}

// uuidToPG wraps a uuid.UUID as a valid pgtype.UUID.
func uuidToPG(u uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: u, Valid: true}
}

// UUIDPtr returns a string pointer to a valid pgtype.UUID, else nil.
func UUIDPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := uuid.UUID(u.Bytes).String()
	return &s
}

// TSPtr returns a formatted-string pointer to a valid timestamp, else nil.
func TSPtr(t pgtype.Timestamptz) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.Format(TimeFormat)
	return &s
}

// TextPtr returns a string pointer to a valid pgtype.Text, else nil.
func TextPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	s := t.String
	return &s
}

// RecordAccessEvent appends an append-only access-log row tying a user to a
// real action (login, chat, topup, subscribe) with the caller's IP and
// user-agent. Best-effort chargeback evidence: failures are logged, never
// surfaced, and never block the request.
func RecordAccessEvent(
	ctx context.Context,
	queries *store.Queries,
	userID uuid.UUID,
	email, kind, ip, userAgent string,
	refID uuid.UUID,
) {
	ref := pgtype.UUID{}
	if refID != uuid.Nil {
		ref = pgtype.UUID{Bytes: refID, Valid: true}
	}
	if err := queries.InsertAccessEvent(ctx, store.InsertAccessEventParams{
		UserID:    userID,
		Email:     email,
		Kind:      kind,
		Ip:        ip,
		UserAgent: userAgent,
		RefID:     ref,
	}); err != nil {
		slog.Error("record access event", "kind", kind, "err", err)
	}
}
