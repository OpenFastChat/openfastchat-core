// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package coreconfig

// Engine tuning constants read by the flow engine, compaction, and the
// web-search client. No env overrides — edit and redeploy. Billing/budget
// and auth limits live in each wrapper's own config, not here.

const (
	// Model/token fallbacks.
	FallbackMaxCompletionTokens = 8192
	FallbackInputPricePerK      = 0.00059
	FallbackOutputPricePerK     = 0.00079

	// Context compaction.
	CompactReservedTokens  = 200 + 1024
	CompactFallbackContext = 8192
	CompactMinAvailable    = 1024
	CompactCharsPerToken   = 4
	CompactMaxOutputTokens = 1024

	// Web search.
	WebSearchTimeoutSecs = 5
	WebSearchMaxResults  = 5
	BraveMaxQueryChars   = 380

	// Brave LLM context endpoint.
	LLMContextMaxTokens         = 8192 // 1024–32768
	LLMContextMaxURLs           = 5    // 1–50
	LLMContextMaxSnippets       = 20   // 1–100
	LLMContextMaxTokensPerURL   = 2048 // 512–8192
	LLMContextMaxSnippetsPerURL = 10   // 1–100
	// "strict", "balanced", "lenient", "disabled"
	LLMContextThresholdMode = "balanced"

	// Web-search query-reformulation prompt.
	WebSearchPrompt = "Convert the following " +
		"chat message into a concise web search " +
		"query. If documents are provided, use " +
		"them to add relevant context to the " +
		"query. Respond with ONLY the search " +
		"query, nothing else.\n\n" +
		"{{documents}}" +
		"Message: {{message}}"
)
