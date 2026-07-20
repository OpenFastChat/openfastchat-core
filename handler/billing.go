package handler

import (
	"context"
	"net/http"

	"github.com/1-Bart-1/openfastchat-core/flowengine"

	"github.com/google/uuid"
)

// Billing authorizes and accounts for a chat prompt. The hosted wrapper injects
// a real budget/credit implementation; self-host injects a no-op. It is the
// single seam through which money/abuse policy enters the shared Execute path —
// core carries no billing schema or policy of its own.
type Billing interface {
	// Preflight runs before any LLM work. On success it returns the per-prompt
	// Exec context. On rejection it writes the HTTP response itself and returns
	// ok=false, and the caller returns immediately.
	Preflight(ctx context.Context, w http.ResponseWriter, userID uuid.UUID) (Exec, bool)
}

// Exec is the per-prompt billing context returned by a passed Preflight.
type Exec interface {
	// Begin builds the (billed or unbilled) LLM client that records activity
	// against the saved user message; the client is handed to the engine.
	Begin(userID, msgID uuid.UUID) flowengine.LLMClient
	// SearchCharged returns the web-search charge hook, or nil when unbilled.
	SearchCharged() func(ctx context.Context, endpoint string, resultCount int)
	// PromptCap is the billed-EUR per-prompt ceiling; 0 means uncapped.
	PromptCap() float64
	// Guest reports the post-reserve free-prompt count for the guest_llm_calls
	// event; ok=false suppresses the event (non-guest / self-host).
	Guest() (used, limit int32, ok bool)
	// Settle records final cost after execution and returns the total billed
	// (0 when unbilled), used for the done event and credit deduction.
	Settle(ctx context.Context) float64
}
