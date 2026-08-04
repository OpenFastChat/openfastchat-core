package handler

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/openfastchat/openfastchat-core/coreconfig"
	store "github.com/openfastchat/openfastchat-core/store"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/ledongthuc/pdf"
)

type UploadHandler struct {
	queries *store.Queries
}

func NewUploadHandler(
	queries *store.Queries,
) *UploadHandler {
	return &UploadHandler{queries: queries}
}

func (h *UploadHandler) Upload(
	w http.ResponseWriter, r *http.Request,
) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, coreconfig.DefaultMaxUploadSizeBytes)
	if err := r.ParseMultipartForm(coreconfig.DefaultMaxUploadSizeBytes); err != nil {
		http.Error(w, "file too large", http.StatusRequestEntityTooLarge)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		WriteServerError(w, "read upload", err)
		return
	}
	text, err := parseFile(header.Filename, data)
	if err != nil {
		slog.Error("parse file", "err", err)
		WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "unsupported or unreadable file",
		})
		return
	}
	if strings.TrimSpace(text) == "" {
		WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "no text content found in file",
		})
		return
	}
	doc, err := h.queries.CreateDocumentWithContent(
		r.Context(), store.CreateDocumentWithContentParams{
			UserID:   userUUID,
			Filename: header.Filename,
			FileSize: int32(len(data)),
			Content:  pgtype.Text{String: text, Valid: true},
		},
	)
	if err != nil {
		WriteServerError(w, "create document", err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{
		"id":       doc.ID.String(),
		"filename": doc.Filename,
		"status":   doc.Status,
	})
}

// parseFile extracts plain text from a file based on extension.
func parseFile(filename string, data []byte) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".txt", ".md", ".markdown":
		return string(data), nil
	case ".pdf":
		return parsePDF(data)
	default:
		return "", fmt.Errorf("unsupported file type: %s", ext)
	}
}

func parsePDF(data []byte) (string, error) {
	reader, err := pdf.NewReader(
		bytes.NewReader(data), int64(len(data)),
	)
	if err != nil {
		return "", fmt.Errorf("open pdf: %w", err)
	}

	var sb strings.Builder
	pages := reader.NumPage()
	for i := 1; i <= pages; i++ {
		page := reader.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, err := page.GetPlainText(nil)
		if err != nil {
			continue
		}
		sb.WriteString(text)
		sb.WriteString("\n")
	}
	return sb.String(), nil
}
