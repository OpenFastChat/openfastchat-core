// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/openfastchat/openfastchat-core/coreconfig"
	"github.com/openfastchat/openfastchat-core/crypto"
	"github.com/openfastchat/openfastchat-core/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// modelRefreshInterval is how often the model catalog is
// re-discovered from every active provider.
const modelRefreshInterval = 24 * time.Hour

// PricingHook fetches per-model pricing overrides for the active
// providers (e.g. by scraping a provider's pricing page). It is
// optional and provider-specific, so wrappers inject their own.
type PricingHook func(ctx context.Context) (map[string][2]float64, error)

// AuditHook records an admin mutation. Wrappers with an audit log
// (hosted) supply one; self-host passes nil.
type AuditHook func(r *http.Request, action, target string, before, after []byte)

// ProviderManager owns the live LLM-provider set: it rebuilds it
// from the encrypted DB rows and re-discovers each provider's
// models. box may be nil when no encryption key is configured, in
// which case rows carrying a stored key are skipped.
type ProviderManager struct {
	queries     *store.Queries
	box         *crypto.SecretBox
	pricingHook PricingHook
}

// NewProviderManager builds the manager. pricingHook may be nil.
func NewProviderManager(
	queries *store.Queries,
	box *crypto.SecretBox,
	pricingHook PricingHook,
) *ProviderManager {
	return &ProviderManager{
		queries:     queries,
		box:         box,
		pricingHook: pricingHook,
	}
}

// Reload rebuilds the active provider list purely from the DB. It
// is the single source of truth: nothing comes from the
// environment, so an admin fully controls providers at runtime.
func (m *ProviderManager) Reload(ctx context.Context) error {
	rows, err := m.queries.ListEnabledProviders(ctx)
	if err != nil {
		return err
	}
	provs := make([]coreconfig.ProviderConfig, 0, len(rows))
	for _, row := range rows {
		key := ""
		if len(row.ApiKeyEnc) > 0 {
			if m.box == nil {
				slog.Warn(
					"provider has key but no encryption key set; skipping",
					"provider", row.Name,
				)
				continue
			}
			k, derr := m.box.Decrypt(row.ApiKeyEnc)
			if derr != nil {
				slog.Error(
					"provider key decrypt failed; skipping",
					"provider", row.Name, "err", derr,
				)
				continue
			}
			key = k
		}
		provs = append(provs, coreconfig.ProviderConfig{
			Name:    row.Name,
			BaseURL: row.BaseUrl,
			APIKey:  key,
		})
	}
	coreconfig.SetActiveProviders(provs)
	return nil
}

// StartModelRefresh discovers models once, then re-discovers on a
// fixed interval until ctx is cancelled.
func (m *ProviderManager) StartModelRefresh(ctx context.Context) {
	m.Refresh(ctx)
	go m.loop(ctx)
}

func (m *ProviderManager) loop(ctx context.Context) {
	defer recoverLog("model refresh loop")
	ticker := time.NewTicker(modelRefreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.Refresh(ctx)
		}
	}
}

// Refresh re-discovers models from every active provider and
// rebuilds the catalog. Safe to call on demand after an admin
// mutates providers. On id collisions the first provider wins.
func (m *ProviderManager) Refresh(ctx context.Context) {
	defer recoverLog("model refresh")

	providers := coreconfig.ActiveProviders()
	if m.pricingHook != nil {
		if pricing, err := m.pricingHook(ctx); err != nil {
			slog.Warn("model refresh: pricing hook failed", "err", err)
		} else {
			coreconfig.SetPricingOverrides(pricing)
		}
	}

	var entries []coreconfig.ModelEntry
	for _, p := range providers {
		client := p.Client()
		models, err := client.FetchModels()
		if err != nil {
			slog.Warn(
				"model refresh: could not fetch models",
				"provider", p.Name, "err", err,
			)
			continue
		}
		for _, mdl := range models {
			entries = append(entries, coreconfig.ModelEntry{
				ID:        mdl.ID,
				OwnedBy:   mdl.OwnedBy,
				MaxTokens: mdl.MaxCompletionTokens,
				Client:    client,
			})
		}
	}
	coreconfig.SetModels(entries)
	slog.Info(
		"model refresh complete",
		"providers", len(providers), "models", len(entries),
	)
}

func recoverLog(where string) {
	if r := recover(); r != nil {
		slog.Error("recovered from panic", "where", where, "panic", r)
	}
}

// ProviderAdmin serves the admin provider-CRUD endpoints. It
// encrypts keys at rest, never returns plaintext, and reloads the
// live provider set (plus a background model refresh) after every
// mutation.
type ProviderAdmin struct {
	queries *store.Queries
	box     *crypto.SecretBox
	manager *ProviderManager
	audit   AuditHook
}

// NewProviderAdmin builds the handler. audit may be nil.
func NewProviderAdmin(
	queries *store.Queries,
	box *crypto.SecretBox,
	manager *ProviderManager,
	audit AuditHook,
) *ProviderAdmin {
	return &ProviderAdmin{
		queries: queries,
		box:     box,
		manager: manager,
		audit:   audit,
	}
}

type providerResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	BaseURL  string `json:"base_url"`
	Enabled  bool   `json:"enabled"`
	HasKey   bool   `json:"has_key"`
	KeyLast4 string `json:"key_last4"`
}

func (h *ProviderAdmin) toResponse(p *store.Provider) providerResponse {
	out := providerResponse{
		ID:      p.ID.String(),
		Name:    p.Name,
		BaseURL: p.BaseUrl,
		Enabled: p.Enabled,
		HasKey:  len(p.ApiKeyEnc) > 0,
	}
	if len(p.ApiKeyEnc) > 0 && h.box != nil {
		if k, err := h.box.Decrypt(p.ApiKeyEnc); err == nil {
			out.KeyLast4 = last4(k)
		}
	}
	return out
}

func last4(s string) string {
	if len(s) <= 4 {
		return s
	}
	return s[len(s)-4:]
}

// List returns every provider with key metadata but no plaintext.
func (h *ProviderAdmin) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListProviders(r.Context())
	if err != nil {
		WriteServerError(w, "list providers", err)
		return
	}
	out := make([]providerResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, h.toResponse(row))
	}
	WriteJSON(w, http.StatusOK, out)
}

type providerRequest struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
	Enabled *bool  `json:"enabled"`
}

// Create adds a provider, encrypting its key.
func (h *ProviderAdmin) Create(w http.ResponseWriter, r *http.Request) {
	var body providerRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.BaseURL = strings.TrimSpace(body.BaseURL)
	if body.Name == "" || body.BaseURL == "" {
		http.Error(w, "name and base_url required", http.StatusBadRequest)
		return
	}
	enc, ok := h.encryptKey(w, body.APIKey)
	if !ok {
		return
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	row, err := h.queries.CreateProvider(r.Context(), store.CreateProviderParams{
		Name:      body.Name,
		BaseUrl:   body.BaseURL,
		ApiKeyEnc: enc,
		Enabled:   enabled,
	})
	if err != nil {
		WriteServerError(w, "create provider", err)
		return
	}
	h.writeAudit(r, "provider.create", body.Name, nil,
		auditJSON(map[string]any{"name": body.Name, "base_url": body.BaseURL}))
	h.reload(r.Context())
	WriteJSON(w, http.StatusOK, h.toResponse(row))
}

// Update edits a provider. An empty api_key leaves the stored key
// unchanged; the name is immutable (it keys model routing).
func (h *ProviderAdmin) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var body providerRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	body.BaseURL = strings.TrimSpace(body.BaseURL)
	if body.BaseURL == "" {
		http.Error(w, "base_url required", http.StatusBadRequest)
		return
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}

	if strings.TrimSpace(body.APIKey) == "" {
		err = h.queries.UpdateProviderNoKey(r.Context(), store.UpdateProviderNoKeyParams{
			ID:      id,
			BaseUrl: body.BaseURL,
			Enabled: enabled,
		})
	} else {
		enc, ok := h.encryptKey(w, body.APIKey)
		if !ok {
			return
		}
		err = h.queries.UpdateProvider(r.Context(), store.UpdateProviderParams{
			ID:        id,
			BaseUrl:   body.BaseURL,
			ApiKeyEnc: enc,
			Enabled:   enabled,
		})
	}
	if err != nil {
		WriteServerError(w, "update provider", err)
		return
	}
	h.writeAudit(r, "provider.update", id.String(), nil,
		auditJSON(map[string]any{"base_url": body.BaseURL, "enabled": enabled}))
	h.reload(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

// Delete removes a provider.
func (h *ProviderAdmin) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	rows, err := h.queries.DeleteProvider(r.Context(), id)
	if err != nil {
		WriteServerError(w, "delete provider", err)
		return
	}
	if rows == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	h.writeAudit(r, "provider.delete", id.String(), nil, nil)
	h.reload(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

// encryptKey seals a plaintext key, or returns (nil, true) for an
// empty key (no-auth endpoint). On a missing encryption key it
// writes a 400 and returns ok=false.
func (h *ProviderAdmin) encryptKey(w http.ResponseWriter, key string) ([]byte, bool) {
	if strings.TrimSpace(key) == "" {
		return nil, true
	}
	if h.box == nil {
		http.Error(w,
			"encryption key not configured; cannot store provider keys",
			http.StatusBadRequest)
		return nil, false
	}
	enc, err := h.box.Encrypt(key)
	if err != nil {
		WriteServerError(w, "encrypt provider key", err)
		return nil, false
	}
	return enc, true
}

func (h *ProviderAdmin) reload(ctx context.Context) {
	if err := h.manager.Reload(ctx); err != nil {
		slog.Error("reload providers", "err", err)
		return
	}
	go h.manager.Refresh(context.Background())
}

func (h *ProviderAdmin) writeAudit(
	r *http.Request, action, target string, before, after []byte,
) {
	if h.audit != nil {
		h.audit(r, action, target, before, after)
	}
}

func auditJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("null")
	}
	return b
}
