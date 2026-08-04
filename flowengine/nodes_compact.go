// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/openfastchat/openfastchat-core/compact"
	"github.com/openfastchat/openfastchat-core/coreconfig"
)

func executeCompact(
	ctx context.Context, n NodeCtx,
) (NodeResult, error) {
	var data CompactData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse compact data: %w", err,
		)
	}

	model := strings.TrimSpace(data.Model)
	if model == "" || model == CompactDefaultModel {
		model = n.Config.CompactModel
	}
	if model == "" {
		return NodeResult{}, fmt.Errorf(
			"compact: no model configured",
		)
	}

	threshold := data.ThresholdWords
	if threshold <= 0 {
		threshold = CompactDefaultThresholdWords
	}

	out := make([]Message, 0, len(n.Inputs))
	for _, msg := range n.Inputs {
		if strings.TrimSpace(msg.Content) == "" {
			out = append(out, msg)
			continue
		}
		original := len(strings.Fields(msg.Content))
		if original <= threshold {
			out = append(out, msg)
			continue
		}
		text, err := compact.Run(ctx, compact.Params{
			LLM:             n.Config.LLM,
			Model:           model,
			SystemPrompt:    data.Prompt,
			Query:           n.UserInput,
			Content:         msg.Content,
			MaxOutputTokens: coreconfig.CompactMaxOutputTokens,
		})
		if err != nil {
			return NodeResult{}, err
		}
		newWords := len(strings.Fields(text))
		if newWords > original &&
			n.Config.OnCompactInflation != nil {
			n.Config.OnCompactInflation(
				ctx, model, original, newWords,
			)
		}
		out = append(out, Message{
			Role: msg.Role, Content: text,
		})
	}
	return NodeResult{Produced: out}, nil
}
