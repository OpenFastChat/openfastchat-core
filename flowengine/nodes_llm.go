// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/1-Bart-1/openfastchat-core/coreconfig"
	"github.com/1-Bart-1/openfastchat-core/llmclient"
)

// maxToolRounds caps how many times the model may request
// tools before we force a final answer, bounding cost and
// preventing infinite tool loops.
const maxToolRounds = 5

func executeLLM(
	ctx context.Context, n NodeCtx,
) (NodeResult, error) {
	var data LLMData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse llm data: %w", err,
		)
	}

	messages := llmMessagesFrom(n.Inputs)

	model := resolveModel(data.Model)
	maxTokens := data.MaxTokens
	if maxTokens <= 0 {
		if cfg, ok := coreconfig.Models[model]; ok {
			maxTokens = cfg.MaxTokens
		}
		if maxTokens <= 0 {
			maxTokens = coreconfig.FallbackMaxCompletionTokens
		}
	}

	tools := n.Config.AvailableTools()
	if len(tools) > 0 {
		text, err := runToolLoop(ctx, n, model, messages, tools, maxTokens)
		if err != nil {
			return NodeResult{}, err
		}
		return NodeResult{
			Produced: []Message{
				{Role: "assistant", Content: text},
			},
		}, nil
	}

	var text string
	if n.Streaming {
		var err error
		text, err = streamCall(
			ctx, n, model, messages, maxTokens,
		)
		if err != nil {
			return NodeResult{}, err
		}
	} else {
		t, err := n.Config.LLM.Complete(
			ctx, model, messages, maxTokens,
		)
		if err != nil {
			return NodeResult{}, fmt.Errorf(
				"llm complete: %w", err,
			)
		}
		text = t
	}

	return NodeResult{
		Produced: []Message{
			{Role: "assistant", Content: text},
		},
	}, nil
}

// runToolLoop drives an agentic loop: ask the model with the
// available tools, run any tools it requests, feed results
// back, and repeat until it answers or we hit the round cap.
// The final answer comes from the deciding call's content, so
// it is not progressively streamed; when this node is the
// streaming source we emit it as a single token event.
func runToolLoop(
	ctx context.Context,
	n NodeCtx,
	model string,
	messages []llmclient.Message,
	tools []llmclient.ToolDef,
	maxTokens int,
) (string, error) {
	for round := 0; round < maxToolRounds; round++ {
		msg, err := n.Config.LLM.CompleteRaw(
			ctx, model, messages, tools, maxTokens,
		)
		if err != nil {
			return "", fmt.Errorf("llm tool call: %w", err)
		}
		if len(msg.ToolCalls) == 0 {
			return emitFinal(n, msg.Content), nil
		}
		messages = append(messages, msg)
		for _, tc := range msg.ToolCalls {
			result, terr := n.Config.ExecuteTool(
				ctx, tc.Function.Name, tc.Function.Arguments,
			)
			if terr != nil {
				result = "tool error: " + terr.Error()
			}
			messages = append(messages, llmclient.Message{
				Role:       "tool",
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
				Content:    result,
			})
		}
	}

	// Round cap hit: force a final answer with tools disabled.
	text, err := n.Config.LLM.Complete(ctx, model, messages, maxTokens)
	if err != nil {
		return "", fmt.Errorf("llm final answer: %w", err)
	}
	return emitFinal(n, text), nil
}

func emitFinal(n NodeCtx, text string) string {
	if n.Streaming && text != "" {
		n.Emit(StreamEvent{Type: "token", Delta: text})
	}
	return text
}

// llmMessagesFrom converts merged input messages into the
// client message shape, ensuring at least one user message
// so the API will respond.
func llmMessagesFrom(in []Message) []llmclient.Message {
	out := make([]llmclient.Message, 0, len(in))
	hasUser := false
	for _, m := range in {
		out = append(out, llmclient.Message{
			Role: m.Role, Content: m.Content,
		})
		if m.Role == "user" {
			hasUser = true
		}
	}
	if !hasUser {
		out = append(out, llmclient.Message{
			Role:    "user",
			Content: "Please respond.",
		})
	}
	return out
}

func streamCall(
	ctx context.Context,
	n NodeCtx,
	model string,
	messages []llmclient.Message,
	maxTokens int,
) (string, error) {
	tokens, errs := n.Config.LLM.Stream(
		ctx, model, messages, maxTokens,
	)

	var sb strings.Builder

loop:
	for tokens != nil || errs != nil {
		select {
		case <-ctx.Done():
			break loop
		case delta, open := <-tokens:
			if !open {
				tokens = nil
				continue
			}
			sb.WriteString(delta)
			n.Emit(StreamEvent{
				Type: "token", Delta: delta,
			})
		case streamErr, open := <-errs:
			if !open {
				errs = nil
				continue
			}
			if streamErr == nil {
				continue
			}
			var rlErr *llmclient.RateLimitError
			if errors.As(streamErr, &rlErr) {
				n.Emit(StreamEvent{
					Type:         "rate_limit",
					RetrySeconds: rlErr.RetrySeconds,
				})
			}
			return "", streamErr
		}
	}

	return sb.String(), nil
}
