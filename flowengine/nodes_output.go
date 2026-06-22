// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"fmt"
)

// executeUserOutput strips the merged inputs down to just
// the most recent assistant message. Validation ensures
// each direct source is an llm or subflow, so an assistant
// message in the ancestor walk is guaranteed in normal
// flows; runtime errors here if it's somehow missing.
func executeUserOutput(
	_ context.Context, n NodeCtx,
) (NodeResult, error) {
	for i := len(n.Inputs) - 1; i >= 0; i-- {
		if n.Inputs[i].Role == "assistant" {
			return NodeResult{
				Produced: []Message{n.Inputs[i]},
			}, nil
		}
	}
	return NodeResult{}, fmt.Errorf(
		"user_output: no assistant message in input",
	)
}
