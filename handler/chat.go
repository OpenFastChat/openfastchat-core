package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/1-Bart-1/openfastchat-core/coreconfig"
	"github.com/1-Bart-1/openfastchat-core/moderation"
	store "github.com/1-Bart-1/openfastchat-core/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextEntry struct {
	NodeID   string `json:"node_id"`
	NodeType string `json:"node_type"`
	Content  string `json:"content"`
}

type ChatHandler struct {
	queries *store.Queries
	pool    *pgxpool.Pool
	cfg     coreconfig.HandlerConfig
}

func NewChatHandler(
	queries *store.Queries,
	pool *pgxpool.Pool,
	cfg coreconfig.HandlerConfig,
) *ChatHandler {
	return &ChatHandler{queries: queries, pool: pool, cfg: cfg}
}

type messageResponse struct {
	ID         string          `json:"id"`
	Role       string          `json:"role"`
	Content    string          `json:"content"`
	Status     string          `json:"status"`
	Context    json.RawMessage `json:"context,omitempty"`
	Candidates json.RawMessage `json:"candidates,omitempty"`
}

// requireThreadOwned parses the URL :id, verifies the auth'd user owns
// it, and writes the appropriate error response on failure.
func (h *ChatHandler) requireThreadOwned(
	w http.ResponseWriter, r *http.Request,
) (userID, threadID uuid.UUID, ok bool) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}
	tid, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}
	if err := RequireThreadAccess(r, h.queries, tid, uid); err != nil {
		http.Error(w, "thread not found", http.StatusNotFound)
		return uuid.Nil, uuid.Nil, false
	}
	return uid, tid, true
}

func (h *ChatHandler) Messages(
	w http.ResponseWriter, r *http.Request,
) {
	_, threadID, ok := h.requireThreadOwned(w, r)
	if !ok {
		return
	}
	rows, err := h.queries.GetThreadMessages(r.Context(), threadID)
	if err != nil {
		WriteServerError(w, "get messages", err)
		return
	}
	resp := make([]messageResponse, len(rows))
	for i, m := range rows {
		resp[i] = messageResponse{
			ID:         m.ID.String(),
			Role:       m.Role,
			Content:    m.Content,
			Status:     m.Status,
			Context:    m.Context,
			Candidates: m.Candidates,
		}
	}
	WriteJSON(w, http.StatusOK, resp)
}

func (h *ChatHandler) ClearMessages(
	w http.ResponseWriter, r *http.Request,
) {
	_, threadID, ok := h.requireThreadOwned(w, r)
	if !ok {
		return
	}
	if err := h.queries.DeleteThreadMessages(r.Context(), threadID); err != nil {
		WriteServerError(w, "clear messages", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type threadResponse struct {
	ID                string   `json:"id"`
	Title             string   `json:"title"`
	UpdatedAt         string   `json:"updated_at"`
	ScrollTopFraction *float32 `json:"scroll_top_fraction"`
}

func (h *ChatHandler) ListThreads(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	rows, err := h.queries.ListThreadsByUser(r.Context(), userUUID)
	if err != nil {
		WriteServerError(w, "list threads", err)
		return
	}
	resp := make([]threadResponse, len(rows))
	for i, t := range rows {
		var scroll *float32
		if t.ScrollTopFraction.Valid {
			f := t.ScrollTopFraction.Float32
			scroll = &f
		}
		resp[i] = threadResponse{
			ID:                t.ID.String(),
			Title:             t.Title,
			UpdatedAt:         t.UpdatedAt.Time.Format(TimeFormat),
			ScrollTopFraction: scroll,
		}
	}
	WriteJSON(w, http.StatusOK, resp)
}

func (h *ChatHandler) CreateThread(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	existing, _ := h.queries.ListThreadsByUser(r.Context(), userUUID)
	title := fmt.Sprintf("Chat %d", len(existing)+1)

	thread, err := h.queries.CreateThread(r.Context(), userUUID)
	if err != nil {
		WriteServerError(w, "create thread", err)
		return
	}
	_ = h.queries.UpdateThreadTitle(
		r.Context(), store.UpdateThreadTitleParams{
			ID: thread.ID, UserID: userUUID, Title: title,
		},
	)
	WriteJSON(w, http.StatusCreated, threadResponse{
		ID:        thread.ID.String(),
		Title:     title,
		UpdatedAt: thread.UpdatedAt.Time.Format(TimeFormat),
	})
}

func (h *ChatHandler) DeleteThread(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	threadUUID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	if err := h.queries.DeleteThread(
		r.Context(), store.DeleteThreadParams{
			ID: threadUUID, UserID: userUUID,
		},
	); err != nil {
		WriteServerError(w, "delete thread", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ChatHandler) UpdateScroll(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	threadUUID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Fraction *float32 `json:"fraction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	param := pgtype.Float4{}
	if body.Fraction != nil {
		param = pgtype.Float4{Float32: *body.Fraction, Valid: true}
	}
	if err := h.queries.UpdateThreadScroll(
		r.Context(), store.UpdateThreadScrollParams{
			ID: threadUUID, UserID: userUUID,
			ScrollTopFraction: param,
		},
	); err != nil {
		WriteServerError(w, "update scroll", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ChatHandler) RenameThread(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	threadUUID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := moderation.CheckName(body.Title); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.queries.UpdateThreadTitle(
		r.Context(), store.UpdateThreadTitleParams{
			ID: threadUUID, UserID: userUUID, Title: body.Title,
		},
	); err != nil {
		WriteServerError(w, "rename thread", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
