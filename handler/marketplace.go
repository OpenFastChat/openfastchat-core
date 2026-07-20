package handler

import (
	"encoding/json"
	"net/http"

	store "github.com/1-Bart-1/openfastchat-core/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type MarketplaceHandler struct {
	queries *store.Queries
}

func NewMarketplaceHandler(queries *store.Queries) *MarketplaceHandler {
	return &MarketplaceHandler{queries: queries}
}

type marketplaceFlow struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Description       *string         `json:"description"`
	Definition        json.RawMessage `json:"definition"`
	AuthorID          string          `json:"author_id"`
	AuthorDisplayName string          `json:"author_display_name"`
	PublicParentID    *string         `json:"public_parent_id"`
	UpdatedAt         string          `json:"updated_at"`
	UpCount           int             `json:"up_count"`
	DownCount         int             `json:"down_count"`
	CurrentUserVote   int             `json:"current_user_vote"`
}

type marketplaceFlowDetail struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Description       *string         `json:"description"`
	Definition        json.RawMessage `json:"definition"`
	AuthorID          string          `json:"author_id"`
	AuthorDisplayName string          `json:"author_display_name"`
	PublicParentID    *string         `json:"public_parent_id"`
	UpdatedAt         string          `json:"updated_at"`
}

func newMarketplaceFlow(
	id uuid.UUID, name string,
	description pgtype.Text, definition json.RawMessage,
	userID uuid.UUID, authorName string,
	parent pgtype.UUID, updated pgtype.Timestamptz,
	upCount, downCount, currentVote int32,
) marketplaceFlow {
	return marketplaceFlow{
		ID:                id.String(),
		Name:              name,
		Description:       TextPtr(description),
		Definition:        definition,
		AuthorID:          userID.String(),
		AuthorDisplayName: authorName,
		PublicParentID:    UUIDPtr(parent),
		UpdatedAt:         updated.Time.Format(TimeFormat),
		UpCount:           int(upCount),
		DownCount:         int(downCount),
		CurrentUserVote:   int(currentVote),
	}
}

func (h *MarketplaceHandler) List(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, _ := OptionalUserUUID(r)
	sort := r.URL.Query().Get("sort")
	switch sort {
	case "new", "hot", "top":
	default:
		sort = "top"
	}
	rows, err := h.queries.ListPublicFlows(
		r.Context(), store.ListPublicFlowsParams{
			UserID: userUUID, Sort: sort,
		},
	)
	if err != nil {
		WriteServerError(w, "list public flows", err)
		return
	}
	out := make([]marketplaceFlow, len(rows))
	for i, row := range rows {
		out[i] = newMarketplaceFlow(
			row.ID, row.Name, row.Description, row.Definition,
			row.UserID, row.AuthorDisplayName, row.PublicParentID,
			row.UpdatedAt, row.UpCount, row.DownCount, row.CurrentUserVote,
		)
	}
	WriteJSON(w, http.StatusOK, out)
}

func (h *MarketplaceHandler) Search(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, _ := OptionalUserUUID(r)
	query := r.URL.Query().Get("q")
	if len(query) < 2 {
		WriteJSON(w, http.StatusOK, []marketplaceFlow{})
		return
	}
	rows, err := h.queries.SearchPublicFlows(
		r.Context(), store.SearchPublicFlowsParams{
			UserID: userUUID, Query: query,
		},
	)
	if err != nil {
		WriteServerError(w, "search public flows", err)
		return
	}
	out := make([]marketplaceFlow, len(rows))
	for i, row := range rows {
		out[i] = newMarketplaceFlow(
			row.ID, row.Name, row.Description, row.Definition,
			row.UserID, row.AuthorDisplayName, row.PublicParentID,
			row.UpdatedAt, row.UpCount, row.DownCount, row.CurrentUserVote,
		)
	}
	WriteJSON(w, http.StatusOK, out)
}

func (h *MarketplaceHandler) Get(
	w http.ResponseWriter, r *http.Request,
) {
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	row, err := h.queries.GetPublicFlowByID(r.Context(), flowID)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	WriteJSON(w, http.StatusOK, marketplaceFlowDetail{
		ID:                row.ID.String(),
		Name:              row.Name,
		Description:       TextPtr(row.Description),
		Definition:        row.Definition,
		AuthorID:          row.UserID.String(),
		AuthorDisplayName: row.AuthorDisplayName,
		PublicParentID:    UUIDPtr(row.PublicParentID),
		UpdatedAt:         row.UpdatedAt.Time.Format(TimeFormat),
	})
}

type voteRequest struct {
	Vote int `json:"vote"`
}

func (h *MarketplaceHandler) Vote(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	user, err := h.queries.GetUserByID(r.Context(), userUUID)
	if err != nil {
		WriteServerError(w, "vote: get user", err)
		return
	}
	if user.IsGuest {
		http.Error(w, "guests cannot vote", http.StatusForbidden)
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	var req voteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if req.Vote == 0 {
		if err := h.queries.DeleteFlowVote(
			r.Context(), store.DeleteFlowVoteParams{
				FlowID: flowID, UserID: userUUID,
			},
		); err != nil {
			WriteServerError(w, "delete vote", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if req.Vote != 1 && req.Vote != -1 {
		http.Error(w, "vote must be -1, 0, or 1", http.StatusBadRequest)
		return
	}
	if err := h.queries.UpsertFlowVote(
		r.Context(), store.UpsertFlowVoteParams{
			FlowID: flowID, UserID: userUUID, Vote: int16(req.Vote),
		},
	); err != nil {
		WriteServerError(w, "upsert vote", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
