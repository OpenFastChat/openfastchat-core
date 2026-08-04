// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"fmt"
	"sync"

	"github.com/openfastchat/openfastchat-core/llmclient"
)

// toolExec runs a tool the model requested and returns the
// string result fed back to it.
type toolExec func(ctx context.Context, args string) (string, error)

type registeredTool struct {
	def  llmclient.ToolDef
	exec toolExec
}

// toolRegistry holds the tools nodes have made available to
// the LLM node for one flow execution. Shared (by pointer)
// across the ExecuteConfig copies handed to each node.
type toolRegistry struct {
	mu   sync.Mutex
	list []registeredTool
}

func newToolRegistry() *toolRegistry {
	return &toolRegistry{}
}

func (r *toolRegistry) register(
	def llmclient.ToolDef, exec toolExec,
) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.list = append(r.list, registeredTool{def: def, exec: exec})
}

func (r *toolRegistry) defs() []llmclient.ToolDef {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.list) == 0 {
		return nil
	}
	out := make([]llmclient.ToolDef, 0, len(r.list))
	for _, t := range r.list {
		out = append(out, t.def)
	}
	return out
}

func (r *toolRegistry) run(
	ctx context.Context, name, args string,
) (string, error) {
	r.mu.Lock()
	var exec toolExec
	for _, t := range r.list {
		if t.def.Function.Name == name {
			exec = t.exec
			break
		}
	}
	r.mu.Unlock()
	if exec == nil {
		return "", fmt.Errorf("unknown tool: %s", name)
	}
	return exec(ctx, args)
}

// RegisterTool makes a tool available to the LLM node that
// runs after the registering node. Called by tool-provider
// nodes (e.g. web_search) during their execution.
func (c ExecuteConfig) RegisterTool(
	def llmclient.ToolDef, exec toolExec,
) {
	if c.tools == nil {
		return
	}
	c.tools.register(def, exec)
}

// AvailableTools returns the tool definitions registered so
// far this execution, to pass into the model request.
func (c ExecuteConfig) AvailableTools() []llmclient.ToolDef {
	if c.tools == nil {
		return nil
	}
	return c.tools.defs()
}

// ExecuteTool runs a model-requested tool by name.
func (c ExecuteConfig) ExecuteTool(
	ctx context.Context, name, args string,
) (string, error) {
	if c.tools == nil {
		return "", fmt.Errorf("no tool registry")
	}
	return c.tools.run(ctx, name, args)
}
