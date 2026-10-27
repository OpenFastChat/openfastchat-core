// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"sort"
	"strings"
)

// mergeInputs walks live ancestors of targetID transitively
// and returns each ancestor's produced messages concatenated
// in (nodePriority, topo) order. Each ancestor is visited
// exactly once, so converging DAG paths never duplicate.
func mergeInputs(
	targetID string,
	incoming map[string][]FlowEdge,
	produced map[string][]Message,
	skipped map[string]bool,
	deadEdges map[string]bool,
	orderIdx map[string]int,
	nodeByID map[string]*FlowNode,
) []Message {
	visited := make(map[string]bool)
	var ancestors []string
	var walk func(id string)
	walk = func(id string) {
		for _, e := range incoming[id] {
			if deadEdges[e.ID] || skipped[e.Source] {
				continue
			}
			if visited[e.Source] {
				continue
			}
			visited[e.Source] = true
			ancestors = append(ancestors, e.Source)
			src := nodeByID[e.Source]
			if src != nil && src.Type == NodeCompact {
				continue
			}
			walk(e.Source)
		}
	}
	walk(targetID)

	sort.SliceStable(ancestors, func(i, j int) bool {
		pi := nodePriority(nodeByID[ancestors[i]].Type)
		pj := nodePriority(nodeByID[ancestors[j]].Type)
		if pi != pj {
			return pi < pj
		}
		return orderIdx[ancestors[i]] < orderIdx[ancestors[j]]
	})

	var merged []Message
	for _, id := range ancestors {
		merged = append(merged, produced[id]...)
	}
	return merged
}

func lastUserContent(msgs []Message) string {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			return msgs[i].Content
		}
	}
	return ""
}

func messagesWithoutLastUser(
	msgs []Message,
) []Message {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			out := make([]Message, 0, len(msgs)-1)
			out = append(out, msgs[:i]...)
			out = append(out, msgs[i+1:]...)
			return out
		}
	}
	return msgs
}

func flattenMessages(msgs []Message) string {
	var sb strings.Builder
	for i, m := range msgs {
		if i > 0 {
			sb.WriteString("\n\n")
		}
		sb.WriteString(m.Role)
		sb.WriteString(": ")
		sb.WriteString(m.Content)
	}
	return sb.String()
}

func nodePriority(t NodeType) int {
	switch t {
	case NodeSystemPrompt:
		return 0
	case NodeMsgHistory:
		return 1
	case NodeFiles:
		return 2
	case NodeWebSearch:
		return 3
	case NodeUserPrompt:
		return 4
	case NodeLLM:
		return 5
	default:
		return 6
	}
}
