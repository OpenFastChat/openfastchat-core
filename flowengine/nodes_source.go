// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"fmt"
)

func executeUserPrompt(
	_ context.Context, n NodeCtx,
) (NodeResult, error) {
	return NodeResult{
		Produced: []Message{
			{Role: "user", Content: n.UserInput},
		},
	}, nil
}

func executeSystemPrompt(
	_ context.Context, n NodeCtx,
) (NodeResult, error) {
	var data SystemPromptData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse system_prompt data: %w", err,
		)
	}
	return NodeResult{
		Produced: []Message{
			{Role: "system", Content: data.Text},
		},
	}, nil
}

func executeMsgHistory(
	_ context.Context, n NodeCtx,
) (NodeResult, error) {
	var data MsgHistoryData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse msg_history data: %w", err,
		)
	}

	msgs := n.Config.Messages
	if data.MaxMessages > 0 &&
		len(msgs) > data.MaxMessages {
		msgs = msgs[len(msgs)-data.MaxMessages:]
	}
	out := make([]Message, len(msgs))
	copy(out, msgs)
	return NodeResult{Produced: out}, nil
}
