// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package compact

import (
	"context"
	_ "embed"
	"fmt"
	"strings"

	"github.com/1-Bart-1/openfastchat-core/coreconfig"
	"github.com/1-Bart-1/openfastchat-core/llmclient"
)

// LLM is the subset of billedllm.Recorder that compact
// needs. Declared locally so this package stays free of a
// direct billedllm dependency.
type LLM interface {
	Complete(
		ctx context.Context,
		model string,
		messages []llmclient.Message,
		maxTokens int,
	) (string, error)
}

//go:embed prompt.md
var defaultPromptText string

// DefaultPrompt returns the embedded fallback system prompt
// used when a compact node has no per-node prompt set.
func DefaultPrompt() string {
	return strings.TrimSpace(defaultPromptText)
}

type Params struct {
	LLM             LLM
	Model           string
	SystemPrompt    string
	Query           string
	Content         string
	MaxOutputTokens int
}

func Run(ctx context.Context, p Params) (string, error) {
	if strings.TrimSpace(p.Content) == "" {
		return "", nil
	}
	system := strings.TrimSpace(p.SystemPrompt)
	if system == "" {
		system = DefaultPrompt()
	}

	user := fmt.Sprintf("Query: %s\n\n%s", p.Query, p.Content)

	out, err := p.LLM.Complete(
		ctx, p.Model,
		[]llmclient.Message{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		p.MaxOutputTokens,
	)
	if err != nil {
		return "", fmt.Errorf("compact: %w", err)
	}
	return out, nil
}

// Title generates a short (max ~6 words) human-readable
// title for a chat thread given the first user prompt and
// the assistant's response. The call goes through the
// billed LLM client, so its tokens are accounted for.
func Title(
	ctx context.Context,
	llm LLM, model, prompt, answer string,
) (string, error) {
	prompt = strings.TrimSpace(prompt)
	answer = strings.TrimSpace(answer)
	if prompt == "" && answer == "" {
		return "", nil
	}

	combined := "User: " + prompt + "\n\nAssistant: " + answer
	limit := titleInputCharLimit(model)
	if len(combined) > limit {
		combined = combined[:limit]
	}

	system := "You name chat conversations. Given the " +
		"first exchange below, produce a title of at " +
		"most 6 words that captures the topic. Reply " +
		"with only the title — no quotes, no period, " +
		"no commentary."

	raw, err := llm.Complete(
		ctx, model,
		[]llmclient.Message{
			{Role: "system", Content: system},
			{Role: "user", Content: combined},
		},
		32,
	)
	if err != nil {
		return "", fmt.Errorf("title: %w", err)
	}

	title := strings.TrimSpace(raw)
	title = strings.Trim(title, "\"'`.")
	title = strings.ReplaceAll(title, "\n", " ")
	if len(title) > 80 {
		title = title[:80]
	}
	return title, nil
}

func titleInputCharLimit(model string) int {
	cfg, ok := coreconfig.Models[model]
	contextTokens := coreconfig.CompactFallbackContext
	if ok && cfg.MaxTokens > 0 {
		contextTokens = cfg.MaxTokens
	}
	available := contextTokens - coreconfig.CompactReservedTokens
	if available < coreconfig.CompactMinAvailable {
		available = coreconfig.CompactMinAvailable
	}
	return available * coreconfig.CompactCharsPerToken
}
