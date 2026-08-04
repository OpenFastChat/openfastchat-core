package middleware

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/openfastchat/openfastchat-core/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const errLogMaxBodyBytes = 512

type userIDHolder struct{ id string }

var userIDHolderKey = contextKey("user_id_holder")

func captureUserID(ctx context.Context, id string) {
	if h, ok := ctx.Value(userIDHolderKey).(*userIDHolder); ok {
		h.id = id
	}
}

// ErrorLog records 4xx/5xx responses to error_events for later triage.
func ErrorLog(queries *store.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &errRecorder{
				ResponseWriter: w,
				status:         http.StatusOK,
				body:           &bytes.Buffer{},
			}
			holder := &userIDHolder{}
			ctx := context.WithValue(r.Context(), userIDHolderKey, holder)
			next.ServeHTTP(rec, r.WithContext(ctx))

			if !shouldLog(rec.status) {
				return
			}

			route := chi.RouteContext(r.Context()).RoutePattern()
			if route == "" {
				route = r.URL.Path
			}

			var userID pgtype.UUID
			if holder.id != "" {
				if parsed, err := uuid.Parse(holder.id); err == nil {
					userID = pgtype.UUID{Bytes: parsed, Valid: true}
				}
			}

			msg := strings.TrimSpace(rec.body.String())

			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				err := queries.InsertErrorEvent(ctx, store.InsertErrorEventParams{
					UserID:     userID,
					Method:     r.Method,
					Path:       route,
					StatusCode: int32(rec.status),
					Message:    msg,
				})
				if err != nil {
					slog.Error("error_events insert", "err", err)
				}
			}()
		})
	}
}

func shouldLog(status int) bool {
	if status < 400 {
		return false
	}
	switch status {
	case http.StatusUnauthorized, http.StatusNotFound:
		return false
	}
	return true
}

type errRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
	body        *bytes.Buffer
}

func (e *errRecorder) WriteHeader(code int) {
	if !e.wroteHeader {
		e.status = code
		e.wroteHeader = true
	}
	e.ResponseWriter.WriteHeader(code)
}

func (e *errRecorder) Write(p []byte) (int, error) {
	if !e.wroteHeader {
		e.wroteHeader = true
	}
	if e.status >= 400 && e.body.Len() < errLogMaxBodyBytes {
		remaining := errLogMaxBodyBytes - e.body.Len()
		if remaining > len(p) {
			remaining = len(p)
		}
		e.body.Write(p[:remaining])
	}
	return e.ResponseWriter.Write(p)
}

func (e *errRecorder) Flush() {
	if f, ok := e.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
