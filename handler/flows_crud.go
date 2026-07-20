package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/1-Bart-1/openfastchat-core/moderation"
	store "github.com/1-Bart-1/openfastchat-core/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

const maxPublishesPerDay = 10

func (h *FlowsHandler) List(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, hasUser := OptionalUserUUID(r)
	resp := []flowResponse{}
	if hasUser {
		ownFlows, err := h.queries.GetFlowsByUser(r.Context(), userUUID)
		if err != nil {
			WriteServerError(w, "list flows", err)
			return
		}
		for _, f := range ownFlows {
			resp = append(resp, userFlowRowToResponse(f))
		}
	}
	featured, err := h.queries.ListFeaturedFlows(r.Context(), userUUID)
	if err != nil {
		WriteServerError(w, "list featured flows", err)
		return
	}
	for _, f := range featured {
		resp = append(resp, featuredFlowRowToResponse(f))
	}
	numberDuplicateNames(resp)
	h.annotateDuplicatePublished(r.Context(), resp)
	WriteJSON(w, http.StatusOK, resp)
}

func (h *FlowsHandler) annotateDuplicatePublished(
	ctx context.Context, flows []flowResponse,
) {
	for i := range flows {
		if !flows[i].Editable || flows[i].IsPublished {
			continue
		}
		hash, err := canonicalFlowHash(flows[i].Definition)
		if err != nil {
			continue
		}
		flowID, err := uuid.Parse(flows[i].ID)
		if err != nil {
			continue
		}
		dup, err := h.queries.GetPublishedFlowDupByHash(
			ctx, store.GetPublishedFlowDupByHashParams{
				DefinitionHash: hash, FlowID: flowID,
			},
		)
		if err != nil {
			continue
		}
		name := dup.Name
		flows[i].DuplicatePublishedFlowName = &name
	}
}

type createFlowRequest struct {
	Name        string          `json:"name"`
	Definition  json.RawMessage `json:"definition"`
	Description *string         `json:"description"`
}

func (h *FlowsHandler) Create(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	var req createFlowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	name := req.Name
	if name == "" {
		name = "Untitled Flow"
	}
	if err := moderation.CheckName(name); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	def := req.Definition
	if len(def) == 0 {
		def = json.RawMessage(`{}`)
	}
	flow, err := h.queries.CreateFlow(
		r.Context(), store.CreateFlowParams{
			UserID:      userUUID,
			Name:        name,
			Definition:  def,
			Description: optionalText(req.Description),
		},
	)
	if err != nil {
		WriteServerError(w, "create flow", err)
		return
	}
	WriteJSON(w, http.StatusCreated, createdFlowToResponse(flow))
}

func (h *FlowsHandler) Get(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	flow, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	)
	if err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	WriteJSON(w, http.StatusOK, flowToResponse(flow))
}

type updateFlowRequest struct {
	Name        string          `json:"name"`
	Definition  json.RawMessage `json:"definition"`
	Description *string         `json:"description"`
}

func (h *FlowsHandler) Update(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	var req updateFlowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := moderation.CheckName(req.Name); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	existing, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	)
	if err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	desc := existing.Description
	if req.Description != nil {
		desc = pgtype.Text{String: *req.Description, Valid: true}
	}
	if err := h.queries.UpdateFlow(
		r.Context(), store.UpdateFlowParams{
			ID:          flowID,
			UserID:      userUUID,
			Definition:  req.Definition,
			Name:        req.Name,
			Description: desc,
		},
	); err != nil {
		WriteServerError(w, "update flow", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FlowsHandler) Delete(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	if err := h.queries.UnpublishFlow(r.Context(), flowID); err != nil {
		WriteServerError(w, "delete flow: unpublish", err)
		return
	}
	if err := h.queries.DeleteFlow(
		r.Context(), store.DeleteFlowParams{
			ID: flowID, UserID: userUUID,
		},
	); err != nil {
		WriteServerError(w, "delete flow", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FlowsHandler) Activate(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	if err := h.queries.SetUserDefaultFlow(
		r.Context(), store.SetUserDefaultFlowParams{
			ID:            userUUID,
			DefaultFlowID: pgtype.UUID{Bytes: flowID, Valid: true},
		},
	); err != nil {
		WriteServerError(w, "set default flow", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FlowsHandler) Reset(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	existing, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	)
	if err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	if !existing.PublicParentID.Valid {
		http.Error(w, "flow has no parent to reset to", http.StatusBadRequest)
		return
	}
	if err := h.queries.ResetFlowToPublicParent(
		r.Context(), store.ResetFlowToPublicParentParams{
			ID: flowID, UserID: userUUID,
		},
	); err != nil {
		WriteServerError(w, "reset flow public", err)
		return
	}
	flow, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	)
	if err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	WriteJSON(w, http.StatusOK, flowToResponse(flow))
}

func (h *FlowsHandler) Publish(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	flow, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	)
	if err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	user, err := h.queries.GetUserByID(r.Context(), userUUID)
	if err != nil {
		WriteServerError(w, "publish: get user", err)
		return
	}
	if err := h.checkPublishAllowedForUser(r.Context(), w, user); err != nil {
		return
	}
	hash, err := canonicalFlowHash(flow.Definition)
	if err != nil {
		http.Error(w, "invalid definition", http.StatusBadRequest)
		return
	}
	if err := h.checkPublishUnique(
		r.Context(), w, hash, flowID,
	); err != nil {
		return
	}
	isFeatured := flow.IsFeatured
	if user.Email == templateUserEmail {
		isFeatured = true
	}
	if err := h.queries.PublishFlow(
		r.Context(), store.PublishFlowParams{
			FlowID:         flowID,
			UserID:         userUUID,
			Name:           flow.Name,
			Description:    flow.Description,
			Definition:     flow.Definition,
			DefinitionHash: hash,
			IsFeatured:     isFeatured,
		},
	); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) &&
			pgErr.ConstraintName == "published_flows_user_name_unique" {
			http.Error(
				w,
				"you already have a published flow with that name — rename this one first",
				http.StatusConflict,
			)
			return
		}
		WriteServerError(w, "publish flow", err)
		return
	}
	h.recordPublishEvent(r.Context(), userUUID, flowID)
	updated, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	)
	if err != nil {
		WriteServerError(w, "reload flow", err)
		return
	}
	WriteJSON(w, http.StatusOK, flowToResponse(updated))
}

func (h *FlowsHandler) Unpublish(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	flowID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	if _, err := h.queries.GetFlowByID(
		r.Context(), store.GetFlowByIDParams{
			ID: flowID, UserID: userUUID,
		},
	); err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	if err := h.queries.UnpublishFlow(r.Context(), flowID); err != nil {
		WriteServerError(w, "unpublish flow", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FlowsHandler) checkPublishUnique(
	ctx context.Context,
	w http.ResponseWriter,
	hash string,
	excludeID uuid.UUID,
) error {
	_, err := h.queries.GetPublishedFlowByHash(
		ctx, store.GetPublishedFlowByHashParams{
			DefinitionHash: hash,
			FlowID:         excludeID,
		},
	)
	if err == nil {
		http.Error(
			w,
			"an identical flow is already published to the marketplace",
			http.StatusConflict,
		)
		return errors.New("duplicate published flow")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		WriteServerError(w, "publish: dup check", err)
		return err
	}
	return nil
}

func (h *FlowsHandler) checkPublishAllowedForUser(
	ctx context.Context,
	w http.ResponseWriter,
	user *store.User,
) error {
	if user.IsGuest {
		http.Error(
			w, "sign in to publish to the marketplace",
			http.StatusForbidden,
		)
		return errors.New("guest cannot publish")
	}
	count, err := h.queries.CountPublishEventsLast24h(ctx, user.ID)
	if err != nil {
		WriteServerError(w, "publish: count events", err)
		return err
	}
	if int(count) >= maxPublishesPerDay {
		http.Error(
			w,
			"daily publish limit reached (10/day) — try again later",
			http.StatusTooManyRequests,
		)
		return errors.New("publish limit reached")
	}
	return nil
}

func (h *FlowsHandler) recordPublishEvent(
	ctx context.Context, userID, flowID uuid.UUID,
) {
	if err := h.queries.InsertPublishEvent(
		ctx, store.InsertPublishEventParams{
			UserID: userID, FlowID: flowID,
		},
	); err != nil {
		slog.Error("insert publish event", "err", err)
	}
}

func optionalText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}
