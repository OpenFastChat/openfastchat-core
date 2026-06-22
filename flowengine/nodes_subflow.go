// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"fmt"
)

func executeSubflow(
	ctx context.Context, n NodeCtx,
) (NodeResult, error) {
	var data SubflowData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse subflow data: %w", err,
		)
	}
	if data.FlowID == "" {
		return NodeResult{}, fmt.Errorf(
			"subflow: no flow_id",
		)
	}
	if n.Config.LoadFlow == nil {
		return NodeResult{}, fmt.Errorf(
			"subflow: no LoadFlow callback configured",
		)
	}
	if n.Config.depth >= SubflowMaxDepth {
		return NodeResult{}, fmt.Errorf(
			"subflow: max nesting depth %d exceeded",
			SubflowMaxDepth,
		)
	}
	if n.Config.visited[data.FlowID] {
		return NodeResult{}, fmt.Errorf(
			"subflow: cycle detected on flow %s",
			data.FlowID,
		)
	}

	subDef, err := n.Config.LoadFlow(data.FlowID)
	if err != nil {
		return NodeResult{}, fmt.Errorf(
			"load subflow %s: %w", data.FlowID, err,
		)
	}

	innerUserInput := lastUserContent(n.Inputs)
	innerHistory := messagesWithoutLastUser(n.Inputs)

	visited := make(
		map[string]bool, len(n.Config.visited)+1,
	)
	for k, v := range n.Config.visited {
		visited[k] = v
	}
	visited[data.FlowID] = true

	subCfg := ExecuteConfig{
		LLM:          n.Config.LLM,
		BraveAPIKey:  n.Config.BraveAPIKey,
		CompactModel: n.Config.CompactModel,
		Messages:     innerHistory,
		OnLLMCost:    n.Config.OnLLMCost,
		LoadFlow:     n.Config.LoadFlow,
		Streaming:    n.Streaming,
		streamed:     n.Config.streamed,
		depth:        n.Config.depth + 1,
		visited:      visited,
	}

	parentEmit := n.Emit
	parentID := n.NodeID
	subEmit := func(ev StreamEvent) {
		if ev.NodeID != "" {
			ev.NodeID = parentID + "/" + ev.NodeID
		}
		parentEmit(ev)
	}

	subResult, err := Execute(
		ctx, subDef, innerUserInput, subCfg, subEmit,
	)
	if err != nil {
		return NodeResult{}, err
	}

	return NodeResult{
		Produced: []Message{{
			Role:    "assistant",
			Content: subResult.FinalOutput,
		}},
	}, nil
}
