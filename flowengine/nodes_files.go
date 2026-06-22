// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"fmt"
)

func executeFiles(
	_ context.Context, n NodeCtx,
) (NodeResult, error) {
	docs := n.Config.Documents
	if len(docs) == 0 {
		return NodeResult{}, nil
	}
	out := make([]Message, 0, len(docs))
	for _, d := range docs {
		out = append(out, Message{
			Role: "user",
			Content: fmt.Sprintf(
				"Attached document %s:\n%s",
				d.Filename, d.Content,
			),
		})
	}
	return NodeResult{Produced: out}, nil
}
