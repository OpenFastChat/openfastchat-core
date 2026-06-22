// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import "context"

// NodeCtx is the everything-the-executor-needs bundle
// passed into every per-node Execute function.
type NodeCtx struct {
	Node      *FlowNode
	NodeID    string
	Inputs    []Message
	UserInput string
	Streaming bool
	Config    ExecuteConfig
	Result    *ExecuteResult
	Emit      func(StreamEvent)
}

// NodeResult is what an executor returns. Produced is the
// node's own contribution to the message flow (NOT the
// passthrough — downstream merging is handled by the
// engine via mergeInputs). Decision is set by question only.
type NodeResult struct {
	Produced []Message
	Decision string
}

// Executor runs a single node and returns its result.
type Executor func(
	ctx context.Context, n NodeCtx,
) (NodeResult, error)

// executors is the single dispatch table for node types.
// Populated in init() to avoid an initialization cycle
// (executeSubflow recurses into Execute, which dispatches
// through this map).
var executors map[NodeType]Executor

func init() {
	executors = map[NodeType]Executor{
		NodeUserPrompt:   executeUserPrompt,
		NodeSystemPrompt: executeSystemPrompt,
		NodeMsgHistory:   executeMsgHistory,
		NodeWebSearch:    executeWebSearch,
		NodeLLM:          executeLLM,
		NodeQuestion:     executeQuestion,
		NodeSubflow:      executeSubflow,
		NodeUserOutput:   executeUserOutput,
		NodeFiles:        executeFiles,
		NodeCompact:      executeCompact,
	}
}
