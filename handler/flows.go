package handler

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/1-Bart-1/openfastchat-core/coreconfig"
	store "github.com/1-Bart-1/openfastchat-core/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FlowsHandler struct {
	queries *store.Queries
	pool    *pgxpool.Pool
	cfg     coreconfig.HandlerConfig
	billing Billing
}

func NewFlowsHandler(
	queries *store.Queries,
	pool *pgxpool.Pool,
	cfg coreconfig.HandlerConfig,
	billing Billing,
) *FlowsHandler {
	return &FlowsHandler{
		queries: queries,
		pool:    pool,
		cfg:     cfg,
		billing: billing,
	}
}

type flowResponse struct {
	ID                         string          `json:"id"`
	Name                       string          `json:"name"`
	DisplayName                string          `json:"display_name"`
	IsPublished                bool            `json:"is_published"`
	IsFeatured                 bool            `json:"is_featured"`
	HasUnpublishedChanges      bool            `json:"has_unpublished_changes"`
	Editable                   bool            `json:"editable"`
	Description                *string         `json:"description"`
	Definition                 json.RawMessage `json:"definition"`
	PublicParentID             *string         `json:"public_parent_id"`
	CreatedAt                  string          `json:"created_at"`
	UpdatedAt                  string          `json:"updated_at"`
	DuplicatePublishedFlowName *string         `json:"duplicate_published_flow_name"`
}

func newFlowResponse(
	id uuid.UUID,
	name string,
	isPublished, isFeatured, editable bool,
	description pgtype.Text,
	definition json.RawMessage,
	publicParentID pgtype.UUID,
	createdAt, updatedAt pgtype.Timestamptz,
	publishedHash pgtype.Text,
) flowResponse {
	dirty := false
	if isPublished {
		if hash, err := canonicalFlowHash(definition); err == nil {
			dirty = !publishedHash.Valid || hash != publishedHash.String
		}
	}
	return flowResponse{
		ID:                    id.String(),
		Name:                  name,
		DisplayName:           name,
		IsPublished:           isPublished,
		IsFeatured:            isFeatured,
		HasUnpublishedChanges: dirty,
		Editable:              editable,
		Description:           TextPtr(description),
		Definition:            definition,
		PublicParentID:        UUIDPtr(publicParentID),
		CreatedAt:             createdAt.Time.Format(TimeFormat),
		UpdatedAt:             updatedAt.Time.Format(TimeFormat),
	}
}

func flowToResponse(f *store.GetFlowByIDRow) flowResponse {
	return newFlowResponse(
		f.ID, f.Name, f.IsPublished, f.IsFeatured, true,
		f.Description, f.Definition, f.PublicParentID,
		f.CreatedAt, f.UpdatedAt, f.PublishedDefinitionHash,
	)
}

func createdFlowToResponse(f *store.Flow) flowResponse {
	return newFlowResponse(
		f.ID, f.Name, false, false, true,
		f.Description, f.Definition, f.PublicParentID,
		f.CreatedAt, f.UpdatedAt, pgtype.Text{},
	)
}

func userFlowRowToResponse(f *store.GetFlowsByUserRow) flowResponse {
	return newFlowResponse(
		f.ID, f.Name, f.IsPublished, f.IsFeatured, f.Editable,
		f.Description, f.Definition, f.PublicParentID,
		f.CreatedAt, f.UpdatedAt, f.PublishedDefinitionHash,
	)
}

func featuredFlowRowToResponse(f *store.ListFeaturedFlowsRow) flowResponse {
	return newFlowResponse(
		f.ID, f.Name, f.IsPublished, f.IsFeatured, f.Editable,
		f.Description, f.Definition, f.PublicParentID,
		f.CreatedAt, f.UpdatedAt, pgtype.Text{},
	)
}

// numberDuplicateNames sets DisplayName for flows that share a name
// with "{name} N", where N=1 is the oldest by CreatedAt. The stored
// Name is left untouched so saves and publishes round-trip cleanly.
func numberDuplicateNames(flows []flowResponse) {
	groups := make(map[string][]int)
	for i, f := range flows {
		groups[f.Name] = append(groups[f.Name], i)
	}
	for _, indices := range groups {
		if len(indices) < 2 {
			continue
		}
		sort.Slice(indices, func(a, b int) bool {
			return flows[indices[a]].CreatedAt < flows[indices[b]].CreatedAt
		})
		for n, i := range indices {
			flows[i].DisplayName = fmt.Sprintf("%s %d", flows[i].Name, n+1)
		}
	}
}
