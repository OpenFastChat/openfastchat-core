// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// ValidationError is returned by Validate when a
// specific node is misconfigured. Callers can use
// errors.As to extract the NodeID.
type ValidationError struct {
	NodeID  string
	Message string
}

func nodeConnectivityLabel(t NodeType) string {
	switch t {
	case NodeSystemPrompt:
		return "system prompt"
	case NodeMsgHistory:
		return "msg_history"
	case NodeFiles:
		return "files"
	default:
		return "node"
	}
}

func (e *ValidationError) Error() string {
	if e.NodeID != "" {
		return fmt.Sprintf(
			"node %s: %s", e.NodeID, e.Message,
		)
	}
	return e.Message
}

// Validate checks that the flow definition is well-formed:
// exactly one user_prompt, one user_output, no cycles,
// all edges reference valid nodes, and source/sink
// constraints are met.
// normalizeLegacyNodeTypes rewrites pre-rename node-type
// strings in place so flows persisted before a rename keep
// validating and executing. Currently maps the old "yes_no"
// type to NodeQuestion (its data shape is forward-compatible
// — a missing answers list defaults to yes/no).
func normalizeLegacyNodeTypes(def FlowDefinition) {
	for i := range def.Nodes {
		if def.Nodes[i].Type == legacyYesNoType {
			def.Nodes[i].Type = NodeQuestion
		}
	}
}

func Validate(def FlowDefinition) error {
	normalizeLegacyNodeTypes(def)
	nodeMap := make(map[string]*FlowNode, len(def.Nodes))
	var promptCount, outputCount, historyCount int

	for i := range def.Nodes {
		n := &def.Nodes[i]
		if _, exists := nodeMap[n.ID]; exists {
			return fmt.Errorf(
				"duplicate node id: %s", n.ID,
			)
		}
		nodeMap[n.ID] = n
		switch n.Type {
		case NodeUserPrompt:
			promptCount++
		case NodeUserOutput:
			outputCount++
		case NodeMsgHistory:
			historyCount++
		case NodeSystemPrompt, NodeWebSearch, NodeLLM,
			NodeQuestion, NodeSubflow, NodeFiles, NodeCompact:
		default:
			return fmt.Errorf(
				"unknown node type: %s", n.Type,
			)
		}
	}

	if promptCount != 1 {
		return fmt.Errorf(
			"need exactly 1 user_prompt node, got %d",
			promptCount,
		)
	}
	if outputCount != 1 {
		return fmt.Errorf(
			"need exactly 1 user_output node, got %d",
			outputCount,
		)
	}
	if historyCount > 1 {
		return fmt.Errorf(
			"at most 1 msg_history node, got %d",
			historyCount,
		)
	}

	inDegree := make(map[string]int, len(def.Nodes))
	for _, n := range def.Nodes {
		inDegree[n.ID] = 0
	}

	for _, e := range def.Edges {
		src, srcOK := nodeMap[e.Source]
		_, tgtOK := nodeMap[e.Target]
		if !srcOK {
			return fmt.Errorf(
				"edge %s references unknown source %s",
				e.ID, e.Source,
			)
		}
		if !tgtOK {
			return fmt.Errorf(
				"edge %s references unknown target %s",
				e.ID, e.Target,
			)
		}
		if src.Type == NodeUserOutput {
			return fmt.Errorf(
				"user_output node cannot have outgoing edges",
			)
		}
		if nodeMap[e.Target].Type == NodeUserPrompt {
			return fmt.Errorf(
				"user_prompt node cannot have incoming edges",
			)
		}
		if nodeMap[e.Target].Type == NodeSystemPrompt {
			return fmt.Errorf(
				"system_prompt node cannot have " +
					"incoming edges",
			)
		}
		if nodeMap[e.Target].Type == NodeMsgHistory {
			return fmt.Errorf(
				"msg_history node cannot have " +
					"incoming edges",
			)
		}
		if nodeMap[e.Target].Type == NodeFiles {
			return fmt.Errorf(
				"files node cannot have incoming edges",
			)
		}
		if src.Type == NodeQuestion {
			if e.SourceHandle == "" ||
				!questionAnswerIDs(src)[e.SourceHandle] {
				return &ValidationError{
					NodeID: src.ID,
					Message: "question outgoing edge must " +
						"use one of its answer handles",
				}
			}
		} else if e.SourceHandle != "" {
			return fmt.Errorf(
				"edge %s has source handle %q on a "+
					"non-branching source",
				e.ID, e.SourceHandle,
			)
		}
		inDegree[e.Target]++
	}

	for _, n := range def.Nodes {
		switch n.Type {
		case NodeLLM:
			if inDegree[n.ID] == 0 {
				return &ValidationError{
					NodeID: n.ID,
					Message: "LLM node has no " +
						"incoming connections",
				}
			}
		case NodeWebSearch:
			if inDegree[n.ID] == 0 {
				return &ValidationError{
					NodeID: n.ID,
					Message: "web search node has " +
						"no incoming connections " +
						"(needs a query)",
				}
			}
		case NodeSystemPrompt:
			var data SystemPromptData
			if err := json.Unmarshal(
				n.Data, &data,
			); err == nil {
				if strings.TrimSpace(data.Text) == "" {
					return &ValidationError{
						NodeID:  n.ID,
						Message: "system prompt is empty",
					}
				}
			}
		case NodeSubflow:
			if inDegree[n.ID] == 0 {
				return &ValidationError{
					NodeID: n.ID,
					Message: "subflow node has no " +
						"incoming connections",
				}
			}
			var data SubflowData
			if err := json.Unmarshal(
				n.Data, &data,
			); err == nil {
				if strings.TrimSpace(data.FlowID) == "" {
					return &ValidationError{
						NodeID:  n.ID,
						Message: "subflow has no flow selected",
					}
				}
			}
		case NodeCompact:
			if inDegree[n.ID] == 0 {
				return &ValidationError{
					NodeID: n.ID,
					Message: "compact node has no " +
						"incoming connections",
				}
			}
		case NodeQuestion:
			if inDegree[n.ID] == 0 {
				return &ValidationError{
					NodeID: n.ID,
					Message: "question node has no " +
						"incoming connections",
				}
			}
			var data QuestionData
			if err := json.Unmarshal(
				n.Data, &data,
			); err == nil {
				if strings.TrimSpace(data.Question) == "" {
					return &ValidationError{
						NodeID:  n.ID,
						Message: "question is empty",
					}
				}
			}
			if len(questionAnswers(&n)) < 2 {
				return &ValidationError{
					NodeID: n.ID,
					Message: "question needs at least " +
						"2 answers",
				}
			}
		}
	}

	var outputID string
	for _, n := range def.Nodes {
		if n.Type == NodeUserOutput {
			outputID = n.ID
			break
		}
	}
	backwardAdj := make(
		map[string][]string, len(def.Nodes),
	)
	for _, e := range def.Edges {
		backwardAdj[e.Target] = append(
			backwardAdj[e.Target], e.Source,
		)
	}
	reachesOutput := make(
		map[string]bool, len(def.Nodes),
	)
	bfsQueue := []string{outputID}
	reachesOutput[outputID] = true
	for len(bfsQueue) > 0 {
		cur := bfsQueue[0]
		bfsQueue = bfsQueue[1:]
		for _, prev := range backwardAdj[cur] {
			if !reachesOutput[prev] {
				reachesOutput[prev] = true
				bfsQueue = append(bfsQueue, prev)
			}
		}
	}
	for _, n := range def.Nodes {
		if n.Type == NodeUserOutput {
			continue
		}
		if reachesOutput[n.ID] {
			continue
		}
		label := nodeConnectivityLabel(n.Type)
		return &ValidationError{
			NodeID: n.ID,
			Message: label + " is not " +
				"connected to the flow",
		}
	}

	_, backEdges, err := TopologicalSortWithBackEdges(def)
	if err != nil {
		var ce *cycleError
		if errors.As(err, &ce) {
			return &ValidationError{
				NodeID: ce.nodeID,
				Message: "loop must pass through a " +
					"question block to provide an exit",
			}
		}
		return err
	}

	for _, e := range def.Edges {
		if !backEdges[e.ID] {
			continue
		}
		src := nodeMap[e.Source]
		if src == nil || !isChoiceNode(src.Type) {
			continue
		}
		var hasExit bool
		for _, oe := range def.Edges {
			if oe.Source == src.ID && !backEdges[oe.ID] {
				hasExit = true
				break
			}
		}
		if !hasExit {
			return &ValidationError{
				NodeID: src.ID,
				Message: "question loops back but has no " +
					"answer that exits the loop",
			}
		}
	}

	return nil
}
