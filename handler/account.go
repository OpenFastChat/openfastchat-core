package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/openfastchat/openfastchat-core/flowengine"
	"github.com/openfastchat/openfastchat-core/middleware"
	"github.com/openfastchat/openfastchat-core/moderation"
	"github.com/openfastchat/openfastchat-core/store"

	"github.com/google/uuid"
)

// AccountConfig injects the wrapper-specific policy the account endpoints need.
// Both hooks are nil-safe (the self-host default).
type AccountConfig struct {
	// PreDelete settles money before a hard delete (hosted: refund refundable
	// credit + cancel subscription). A non-nil error aborts the delete.
	PreDelete func(ctx context.Context, userID uuid.UUID) error
	// CooldownExempt reports whether an email skips the 30-day re-registration
	// cooldown (hosted: admins, so they can recreate and re-inherit admin).
	CooldownExempt func(ctx context.Context, email string) bool
}

// AccountHandler serves the shared signed-in account endpoints: display name,
// preferred model, node menu, logout, and account deletion.
type AccountHandler struct {
	queries *store.Queries
	cfg     AccountConfig
}

// NewAccountHandler builds the account endpoints.
func NewAccountHandler(queries *store.Queries, cfg AccountConfig) *AccountHandler {
	return &AccountHandler{queries: queries, cfg: cfg}
}

// CascadeDeleteUser permanently (hard) deletes a user. Chats, documents and
// private flows cascade away; usage/payments are anonymised (ON DELETE SET
// NULL); published flows are handed to the anonymous sentinel author. cfg.
// PreDelete settles money first (its failure aborts the delete so no charge is
// orphaned). When blockRecreate is set the email enters the 30-day cooldown,
// unless cfg.CooldownExempt clears it.
func CascadeDeleteUser(
	ctx context.Context,
	queries *store.Queries,
	cfg AccountConfig,
	uid uuid.UUID,
	email string,
	blockRecreate bool,
) error {
	if cfg.PreDelete != nil {
		if err := cfg.PreDelete(ctx, uid); err != nil {
			return err
		}
	}
	if err := queries.ReassignUserPublishedFlowsToAnon(ctx, uid); err != nil {
		slog.Error("delete account: reassign published flows", "user", uid, "err", err)
	}
	if err := queries.ReassignUserPublishedFlowOwnersToAnon(ctx, uid); err != nil {
		slog.Error("delete account: reassign flow owners", "user", uid, "err", err)
	}
	if blockRecreate {
		exempt := cfg.CooldownExempt != nil && cfg.CooldownExempt(ctx, email)
		if !exempt {
			if err := queries.InsertDeletedAccount(ctx, HashEmail(email)); err != nil {
				slog.Error("delete account: insert hash", "err", err)
			}
		}
	}
	return queries.DeleteUser(ctx, uid)
}

// DeleteAccount lets a signed-in user hard-delete their own account after
// confirming their email.
func (h *AccountHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	_, email, _ := middleware.UserFromContext(r.Context())

	var body struct {
		ConfirmEmail string `json:"confirm_email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if !strings.EqualFold(body.ConfirmEmail, email) {
		http.Error(w, "email does not match", http.StatusForbidden)
		return
	}
	if err := CascadeDeleteUser(r.Context(), h.queries, h.cfg, uid, email, true); err != nil {
		WriteServerError(w, "delete account", err)
		return
	}
	slog.Info("account deleted", "email", email)
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// UpdateDisplayName lets a signed-in user rename themselves. The name is
// trimmed and capped at 40 runes; uniqueness is not required.
func (h *AccountHandler) UpdateDisplayName(w http.ResponseWriter, r *http.Request) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	var body struct {
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(body.DisplayName)
	if name == "" || len([]rune(name)) > 40 {
		http.Error(w, "display name must be 1–40 characters", http.StatusBadRequest)
		return
	}
	if err := moderation.CheckName(name); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	taken, err := h.queries.DisplayNameTaken(r.Context(), store.DisplayNameTakenParams{Lower: name, ID: uid})
	if err != nil {
		WriteServerError(w, "display name check", err)
		return
	}
	if taken {
		http.Error(w, "username already taken", http.StatusConflict)
		return
	}
	if err := h.queries.UpdateDisplayName(r.Context(), store.UpdateDisplayNameParams{ID: uid, DisplayName: name}); err != nil {
		WriteServerError(w, "update display name", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"display_name": name})
}

// GetPreferredModel returns the user's preferred model.
func (h *AccountHandler) GetPreferredModel(w http.ResponseWriter, r *http.Request) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	model, err := h.queries.GetPreferredModel(r.Context(), uid)
	if err != nil {
		WriteServerError(w, "get preferred model", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"model": model})
}

// UpdatePreferredModel sets the user's preferred model.
func (h *AccountHandler) UpdatePreferredModel(w http.ResponseWriter, r *http.Request) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	var body struct {
		Model string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Model == "" {
		http.Error(w, "model required", http.StatusBadRequest)
		return
	}
	if err := h.queries.UpdatePreferredModel(r.Context(), store.UpdatePreferredModelParams{
		ID: uid, PreferredModel: body.Model,
	}); err != nil {
		WriteServerError(w, "update preferred model", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// paletteNodeTypes is the set of node types a user may put in their flow-editor
// menu. Fixed nodes (user_prompt, user_output) are placed automatically.
var paletteNodeTypes = map[string]bool{
	string(flowengine.NodeSystemPrompt): true,
	string(flowengine.NodeMsgHistory):   true,
	string(flowengine.NodeFiles):        true,
	string(flowengine.NodeWebSearch):    true,
	string(flowengine.NodeLLM):          true,
	string(flowengine.NodeQuestion):     true,
	string(flowengine.NodeCompact):      true,
	string(flowengine.NodeSubflow):      true,
}

// GetNodeMenu returns the user's flow-editor node palette.
func (h *AccountHandler) GetNodeMenu(w http.ResponseWriter, r *http.Request) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	raw, err := h.queries.GetNodeMenu(r.Context(), uid)
	if err != nil {
		WriteServerError(w, "get node menu", err)
		return
	}
	menu := []string{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &menu); err != nil {
			WriteServerError(w, "decode node menu", err)
			return
		}
	}
	WriteJSON(w, http.StatusOK, menu)
}

// UpdateNodeMenu replaces the user's flow-editor node palette.
func (h *AccountHandler) UpdateNodeMenu(w http.ResponseWriter, r *http.Request) {
	uid, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	var menu []string
	if err := json.NewDecoder(r.Body).Decode(&menu); err != nil {
		http.Error(w, "expected an array of node types", http.StatusBadRequest)
		return
	}
	seen := map[string]bool{}
	deduped := make([]string, 0, len(menu))
	for _, t := range menu {
		if !paletteNodeTypes[t] {
			http.Error(w, "unknown node type: "+t, http.StatusBadRequest)
			return
		}
		if seen[t] {
			continue
		}
		seen[t] = true
		deduped = append(deduped, t)
	}
	encoded, err := json.Marshal(deduped)
	if err != nil {
		WriteServerError(w, "encode node menu", err)
		return
	}
	if err := h.queries.UpdateNodeMenu(r.Context(), store.UpdateNodeMenuParams{ID: uid, NodeMenu: encoded}); err != nil {
		WriteServerError(w, "update node menu", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Logout clears the session cookie.
func (h *AccountHandler) Logout(w http.ResponseWriter, r *http.Request) {
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, middleware.AuthCookie("session", "", -1))
}
