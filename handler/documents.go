package handler

import (
	"net/http"

	store "github.com/1-Bart-1/openfastchat-core/store"
)

type DocumentsHandler struct {
	queries *store.Queries
}

func NewDocumentsHandler(queries *store.Queries) *DocumentsHandler {
	return &DocumentsHandler{queries: queries}
}

type documentResponse struct {
	ID        string `json:"id"`
	Filename  string `json:"filename"`
	FileSize  int32  `json:"file_size"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
	CreatedAt string `json:"created_at"`
}

func (h *DocumentsHandler) List(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	docs, err := h.queries.GetDocumentsByUser(r.Context(), userUUID)
	if err != nil {
		WriteServerError(w, "list documents", err)
		return
	}
	resp := make([]documentResponse, len(docs))
	for i, d := range docs {
		resp[i] = documentResponse{
			ID:        d.ID.String(),
			Filename:  d.Filename,
			FileSize:  d.FileSize,
			Status:    d.Status,
			CreatedAt: d.CreatedAt.Time.Format(TimeFormat),
		}
		if d.ErrorMessage.Valid {
			resp[i].Error = d.ErrorMessage.String
		}
	}
	WriteJSON(w, http.StatusOK, resp)
}

func (h *DocumentsHandler) Delete(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	docID, ok := ParseUUIDParamOr400(w, r, "id")
	if !ok {
		return
	}
	if err := h.queries.DeleteDocument(
		r.Context(), store.DeleteDocumentParams{
			ID: docID, UserID: userUUID,
		},
	); err != nil {
		WriteServerError(w, "delete document", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
