package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"github.com/1-Bart-1/openfastchat-core/compact"
	"github.com/1-Bart-1/openfastchat-core/flowengine"
	"github.com/1-Bart-1/openfastchat-core/middleware"
	"github.com/1-Bart-1/openfastchat-core/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type executeFlowRequest struct {
	FlowID     string                     `json:"flow_id"`
	ThreadID   string                     `json:"thread_id"`
	Definition *flowengine.FlowDefinition `json:"definition"`
	Content    string                     `json:"content"`
}

// Execute runs a chat prompt through the target flow, streaming the result as
// ndjson. All money/abuse policy is delegated to the injected Billing seam;
// everything else — flow/thread resolution, message persistence, engine run,
// auto-title — is shared across every wrapper.
func (h *FlowsHandler) Execute(w http.ResponseWriter, r *http.Request) {
	userUUID, ok := RequireUserOr401(w, r)
	if !ok {
		return
	}
	var req executeFlowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Content == "" {
		http.Error(w, "content required", http.StatusBadRequest)
		return
	}

	def, ok := h.resolveFlowDefinition(r.Context(), w, req, userUUID)
	if !ok {
		return
	}

	exec, ok := h.billing.Preflight(r.Context(), w, userUUID)
	if !ok {
		return
	}

	thread, err := h.resolveExecuteThread(r.Context(), req.ThreadID, userUUID)
	if err != nil {
		slog.Error("get thread", "err", err)
		http.Error(w, "thread not found", http.StatusNotFound)
		return
	}
	userMsg, err := h.queries.CreateMessage(r.Context(), store.CreateMessageParams{
		ThreadID: thread.ID,
		Role:     "user",
		Content:  req.Content,
		Status:   "complete",
	})
	if err != nil {
		WriteServerError(w, "save user message", err)
		return
	}

	_, email, _ := middleware.UserFromContext(r.Context())
	RecordAccessEvent(
		r.Context(), h.queries, userUUID, email,
		"chat", middleware.ClientIP(r, h.cfg.TrustForwardedIP), r.UserAgent(),
		userMsg.ID,
	)

	emit := newStreamEmitter(w)
	emit(flowengine.StreamEvent{Type: "user_saved", MessageID: userMsg.ID.String()})

	if used, limit, ok := exec.Guest(); ok {
		u := used
		emit(flowengine.StreamEvent{
			Type:              "guest_llm_calls",
			GuestLLMCallsUsed: &u,
			GuestLimitReached: used >= limit,
		})
	}

	llm := exec.Begin(userUUID, userMsg.ID)

	history := h.loadThreadHistory(r.Context(), thread.ID, userMsg.ID)
	documents := h.loadUserDocuments(r.Context(), userUUID)
	outputInputs := flowengine.FindOutputInputs(def)

	var contextBlocks []contextEntry
	wrappedEmit := func(ev flowengine.StreamEvent) {
		if entry, ok := contextBlockFromEvent(ev, outputInputs); ok {
			contextBlocks = append(contextBlocks, entry)
		}
		emit(ev)
	}

	var onLLMCost func(float64) error
	if cap := exec.PromptCap(); cap > 0 {
		onLLMCost = promptCostGuard(cap)
	}

	result, execErr := flowengine.Execute(
		r.Context(), def, req.Content,
		flowengine.ExecuteConfig{
			LLM:                llm,
			BraveAPIKey:        h.cfg.BraveAPIKey,
			CompactModel:       h.cfg.CompactModel,
			Messages:           history,
			Documents:          documents,
			RootFlowID:         req.FlowID,
			OnLLMCost:          onLLMCost,
			OnSearchCharged:    exec.SearchCharged(),
			OnCompactInflation: h.reportCompactInflation(userUUID),
			LoadFlow:           h.loadSubflowDefinition(r.Context(), userUUID),
			Streaming:          true,
		},
		wrappedEmit,
	)

	dbCtx := context.Background()
	stopped := r.Context().Err() != nil

	totalBilled := exec.Settle(dbCtx)
	if result != nil {
		result.TotalCost = totalBilled
	}

	if execErr != nil && !stopped {
		emit(buildErrorEvent(execErr))
		return
	}

	content := ""
	if result != nil {
		content = result.FinalOutput
	}
	if stopped {
		content += "[stopped]"
	}
	assistantMsgID := h.saveAssistantMessage(
		dbCtx, thread.ID, content, stopped, contextBlocks, result,
	)

	if err := h.queries.UpdateThreadUpdatedAt(dbCtx, store.UpdateThreadUpdatedAtParams{
		ID: thread.ID, UserID: userUUID,
	}); err != nil {
		slog.Error("update thread timestamp", "err", err)
	}

	if len(history) == 0 && content != "" && !stopped {
		h.autoTitleThread(dbCtx, llm, thread.ID, userUUID, req.Content, content, emit)
	}

	if !stopped {
		emit(buildDoneEvent(assistantMsgID, content, result))
	}
	emit(flowengine.StreamEvent{Type: "flow_finished"})
}

// resolveExecuteThread picks the target thread: an explicit thread_id (verified
// to belong to the caller) takes priority; otherwise the caller's most-recent
// thread, created on the fly if none exists.
func (h *FlowsHandler) resolveExecuteThread(
	ctx context.Context, threadIDStr string, userUUID uuid.UUID,
) (*store.Thread, error) {
	if threadIDStr != "" {
		threadID, err := uuid.Parse(threadIDStr)
		if err != nil {
			return nil, fmt.Errorf("invalid thread_id: %w", err)
		}
		return h.queries.GetThreadByID(ctx, store.GetThreadByIDParams{
			ID: threadID, UserID: userUUID,
		})
	}
	thread, err := h.queries.GetThreadByUserID(ctx, userUUID)
	if err == nil {
		return thread, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return h.queries.CreateThread(ctx, userUUID)
}

func (h *FlowsHandler) resolveFlowDefinition(
	ctx context.Context, w http.ResponseWriter, req executeFlowRequest, userID uuid.UUID,
) (flowengine.FlowDefinition, bool) {
	if req.Definition != nil {
		return *req.Definition, true
	}
	if req.FlowID == "" {
		http.Error(w, "flow_id or definition required", http.StatusBadRequest)
		return flowengine.FlowDefinition{}, false
	}
	flowID, err := uuid.Parse(req.FlowID)
	if err != nil {
		http.Error(w, "invalid flow_id", http.StatusBadRequest)
		return flowengine.FlowDefinition{}, false
	}
	flow, err := h.queries.GetFlowByID(ctx, store.GetFlowByIDParams{ID: flowID, UserID: userID})
	if err != nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return flowengine.FlowDefinition{}, false
	}
	var def flowengine.FlowDefinition
	if err := json.Unmarshal(flow.Definition, &def); err != nil {
		http.Error(w, "invalid flow definition", http.StatusBadRequest)
		return flowengine.FlowDefinition{}, false
	}
	return def, true
}

// loadSubflowDefinition returns a LoadFlow callback that prefers the caller's
// own copy of a flow and falls back to the public copy.
func (h *FlowsHandler) loadSubflowDefinition(
	ctx context.Context, userID uuid.UUID,
) func(string) (flowengine.FlowDefinition, error) {
	return func(flowID string) (flowengine.FlowDefinition, error) {
		var def flowengine.FlowDefinition
		parsed, err := uuid.Parse(flowID)
		if err != nil {
			return def, fmt.Errorf("invalid flow_id: %w", err)
		}
		var defBytes []byte
		row, err := h.queries.GetFlowByID(ctx, store.GetFlowByIDParams{ID: parsed, UserID: userID})
		if err == nil {
			defBytes = row.Definition
		} else {
			pub, perr := h.queries.GetPublicFlowByID(ctx, parsed)
			if perr != nil {
				return def, fmt.Errorf("load subflow: %w", err)
			}
			defBytes = pub.Definition
		}
		if err := json.Unmarshal(defBytes, &def); err != nil {
			return def, fmt.Errorf("parse subflow def: %w", err)
		}
		return def, nil
	}
}

func (h *FlowsHandler) loadUserDocuments(
	ctx context.Context, userID uuid.UUID,
) []flowengine.Document {
	rows, err := h.queries.GetDocumentsByUser(ctx, userID)
	if err != nil {
		slog.Error("load documents", "err", err)
		return nil
	}
	docs := make([]flowengine.Document, 0, len(rows))
	for _, row := range rows {
		if row.Status != "ready" || !row.Content.Valid {
			continue
		}
		docs = append(docs, flowengine.Document{
			Filename: row.Filename,
			Content:  row.Content.String,
		})
	}
	return docs
}

func (h *FlowsHandler) reportCompactInflation(
	userID uuid.UUID,
) func(context.Context, string, int, int) {
	return func(ctx context.Context, model string, originalWords, compactedWords int) {
		payload := map[string]any{
			"model":           model,
			"original_words":  originalWords,
			"compacted_words": compactedWords,
		}
		ctxJSON, _ := json.Marshal(payload)
		err := h.queries.InsertReportedIssue(ctx, store.InsertReportedIssueParams{
			UserID: uuidToPG(userID),
			Kind:   "compact_inflation",
			Message: fmt.Sprintf("compact %s grew %d→%d words",
				model, originalWords, compactedWords),
			Context: ctxJSON,
		})
		if err != nil {
			slog.Error("report compact inflation", "err", err)
		}
	}
}

func (h *FlowsHandler) loadThreadHistory(
	ctx context.Context, threadID, excludeID uuid.UUID,
) []flowengine.Message {
	rows, err := h.queries.GetThreadMessages(ctx, threadID)
	if err != nil {
		slog.Error("load thread messages", "err", err)
		return nil
	}
	history := make([]flowengine.Message, 0, len(rows))
	for _, row := range rows {
		if row.ID == excludeID {
			continue
		}
		history = append(history, flowengine.Message{
			Role: row.Role, Content: row.Content,
		})
	}
	return history
}

func (h *FlowsHandler) saveAssistantMessage(
	ctx context.Context,
	threadID uuid.UUID,
	content string,
	stopped bool,
	contextBlocks []contextEntry,
	result *flowengine.ExecuteResult,
) string {
	if content == "" {
		return ""
	}
	status := "complete"
	if stopped {
		status = "stopped"
	}
	var ctxJSON []byte
	if len(contextBlocks) > 0 {
		ctxJSON, _ = json.Marshal(contextBlocks)
	}
	var candidatesJSON []byte
	if result != nil && len(result.Candidates) > 1 {
		candidatesJSON, _ = json.Marshal(result.Candidates)
	}
	msg, err := h.queries.CreateMessage(ctx, store.CreateMessageParams{
		ThreadID:   threadID,
		Role:       "assistant",
		Content:    content,
		Status:     status,
		Context:    ctxJSON,
		Candidates: candidatesJSON,
	})
	if err != nil {
		slog.Error("save assistant message", "err", err)
		return ""
	}
	return msg.ID.String()
}

func (h *FlowsHandler) autoTitleThread(
	ctx context.Context,
	llm flowengine.LLMClient,
	threadID, userID uuid.UUID,
	userContent, assistantContent string,
	emit func(flowengine.StreamEvent),
) {
	title, err := compact.Title(ctx, llm, h.cfg.CompactModel, userContent, assistantContent)
	if err != nil {
		slog.Error("auto-title thread", "err", err)
		return
	}
	if strings.TrimSpace(title) == "" {
		return
	}
	if err := h.queries.UpdateThreadTitle(ctx, store.UpdateThreadTitleParams{
		ID: threadID, UserID: userID, Title: title,
	}); err != nil {
		slog.Error("auto-title thread", "err", err)
		return
	}
	emit(flowengine.StreamEvent{Type: "thread_renamed", Title: title})
}

func newStreamEmitter(w http.ResponseWriter) func(flowengine.StreamEvent) {
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, canFlush := w.(http.Flusher)
	var mu sync.Mutex
	return func(ev flowengine.StreamEvent) {
		mu.Lock()
		defer mu.Unlock()
		line, _ := json.Marshal(ev)
		fmt.Fprintf(w, "%s\n", line)
		if canFlush {
			flusher.Flush()
		}
	}
}

func promptCostGuard(maxCost float64) func(float64) error {
	return func(cost float64) error {
		if cost > maxCost {
			return fmt.Errorf("prompt cost %.4f exceeds limit %.4f", cost, maxCost)
		}
		return nil
	}
}

func contextBlockFromEvent(
	ev flowengine.StreamEvent, outputInputs map[string]bool,
) (contextEntry, bool) {
	if ev.Type != "node_done" || !ev.ShowOutput {
		return contextEntry{}, false
	}
	if outputInputs[ev.NodeID] {
		return contextEntry{}, false
	}
	switch ev.NodeType {
	case "user_output", "user_prompt", "msg_history":
		return contextEntry{}, false
	}
	content := ev.Output
	if content == "" {
		return contextEntry{}, false
	}
	return contextEntry{NodeID: ev.NodeID, NodeType: ev.NodeType, Content: content}, true
}

func buildErrorEvent(execErr error) flowengine.StreamEvent {
	ev := flowengine.StreamEvent{Type: "error", Message: "an error occurred"}
	var ve *flowengine.ValidationError
	if errors.As(execErr, &ve) {
		ev.NodeID = ve.NodeID
		ev.Message = ve.Message
		ev.UserError = true
	}
	return ev
}

func buildDoneEvent(
	assistantMsgID, content string, result *flowengine.ExecuteResult,
) flowengine.StreamEvent {
	ev := flowengine.StreamEvent{
		Type:      "done",
		MessageID: assistantMsgID,
		Content:   content,
		TotalCost: "0",
	}
	if result != nil {
		ev.TotalCost = fmt.Sprintf("%.8f", result.TotalCost)
		if len(result.Candidates) > 1 {
			ev.Candidates = result.Candidates
		}
	}
	return ev
}
