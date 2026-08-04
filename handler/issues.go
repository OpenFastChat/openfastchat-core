package handler

import (
	"encoding/json"
	"net/http"

	store "github.com/openfastchat/openfastchat-core/store"

	"github.com/jackc/pgx/v5/pgtype"
)

type IssuesHandler struct {
	queries *store.Queries
}

func NewIssuesHandler(queries *store.Queries) *IssuesHandler {
	return &IssuesHandler{queries: queries}
}

type reportIssueRequest struct {
	Kind        string          `json:"kind"`
	StatusCode  int32           `json:"status_code"`
	HttpMethod  string          `json:"http_method"`
	HttpPath    string          `json:"http_path"`
	Message     string          `json:"message"`
	UserComment string          `json:"user_comment"`
	Context     json.RawMessage `json:"context"`
}

const (
	maxIssueStringField = 2048
	maxIssueCommentLen  = 4096
	maxIssueContextLen  = 16384
)

func clipString(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	return s[:limit]
}

func (h *IssuesHandler) Report(
	w http.ResponseWriter, r *http.Request,
) {
	var req reportIssueRequest
	if err := json.NewDecoder(
		http.MaxBytesReader(w, r.Body, 32*1024),
	).Decode(&req); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	if req.Kind == "" {
		http.Error(w, "kind required", http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if uid, ok := OptionalUserUUID(r); ok {
		userID = pgtype.UUID{Bytes: uid, Valid: true}
	}

	var context []byte
	if len(req.Context) > 0 && len(req.Context) <= maxIssueContextLen {
		var probe any
		if json.Unmarshal(req.Context, &probe) == nil {
			context = []byte(req.Context)
		}
	}

	err := h.queries.InsertReportedIssue(
		r.Context(), store.InsertReportedIssueParams{
			UserID:      userID,
			Kind:        clipString(req.Kind, maxIssueStringField),
			StatusCode:  req.StatusCode,
			HttpMethod:  clipString(req.HttpMethod, 16),
			HttpPath:    clipString(req.HttpPath, maxIssueStringField),
			Message:     clipString(req.Message, maxIssueStringField),
			UserComment: clipString(req.UserComment, maxIssueCommentLen),
			Context:     context,
		},
	)
	if err != nil {
		WriteServerError(w, "insert reported issue", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
