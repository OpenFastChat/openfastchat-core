// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/1-Bart-1/openfastchat-core/coreconfig"
	"github.com/1-Bart-1/openfastchat-core/llmclient"
)

func executeQuestion(
	ctx context.Context, n NodeCtx,
) (NodeResult, error) {
	var data QuestionData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse question data: %w", err,
		)
	}

	question := strings.TrimSpace(data.Question)
	if question == "" {
		return NodeResult{}, fmt.Errorf(
			"question: question is empty",
		)
	}
	answers := questionAnswers(n.Node)
	if len(answers) == 0 {
		return NodeResult{}, fmt.Errorf(
			"question: no answers defined",
		)
	}
	if len(n.Inputs) == 0 {
		return NodeResult{}, fmt.Errorf(
			"question: no input to evaluate",
		)
	}

	model := resolveModel(data.Model)
	maxTokens := 32
	if cfg, ok := coreconfig.Models[model]; ok &&
		cfg.MaxTokens > 0 && cfg.MaxTokens < maxTokens {
		maxTokens = cfg.MaxTokens
	}

	labels := make([]string, len(answers))
	for i, a := range answers {
		labels[i] = a.Label
	}

	flat := flattenMessages(n.Inputs)
	messages := []llmclient.Message{
		{
			Role: "system",
			Content: "You are a routing classifier. Read " +
				"the input and the question, then pick the " +
				"single answer from the list that best " +
				"fits. Respond with exactly that answer " +
				"wrapped like >>>answer<<< and nothing " +
				"else. No explanation, no other text.",
		},
		{
			Role: "user",
			Content: "Input:\n" + flat +
				"\n\nQuestion: " + question +
				"\n\nAnswers: " + strings.Join(labels, ", ") +
				"\n\nRespond with >>>answer<<<.",
		},
	}

	text, err := n.Config.LLM.Complete(
		ctx, model, messages, maxTokens,
	)
	if err != nil {
		return NodeResult{}, fmt.Errorf(
			"question groq: %w", err,
		)
	}

	return NodeResult{
		Decision: parseAnswer(text, answers),
	}, nil
}

// parseAnswer maps the classifier's output to an answer ID.
// It prefers the explicit >>>label<<< wrapper, then a unique
// substring match, and finally falls back to the first
// answer so the flow keeps running rather than dead-ending.
func parseAnswer(text string, answers []Answer) string {
	lower := strings.ToLower(text)
	for _, a := range answers {
		if strings.Contains(
			lower, ">>>"+strings.ToLower(a.Label)+"<<<",
		) {
			return a.ID
		}
	}
	var hit string
	count := 0
	for _, a := range answers {
		if a.Label != "" &&
			strings.Contains(lower, strings.ToLower(a.Label)) {
			hit = a.ID
			count++
		}
	}
	if count == 1 {
		return hit
	}
	return answers[0].ID
}

// questionAnswers returns the node's cleaned answer list:
// trimmed, empty-id-dropped, de-duped by ID. An empty list
// (legacy yes_no nodes have no answers field) falls back to
// the default yes/no pair, whose IDs match the handles those
// older flows' edges already use.
func questionAnswers(node *FlowNode) []Answer {
	var data QuestionData
	_ = json.Unmarshal(node.Data, &data)
	seen := map[string]bool{}
	var out []Answer
	for _, a := range data.Answers {
		a.ID = strings.TrimSpace(a.ID)
		a.Label = strings.TrimSpace(a.Label)
		if a.ID == "" || seen[a.ID] {
			continue
		}
		seen[a.ID] = true
		out = append(out, a)
	}
	if len(out) == 0 {
		return defaultQuestionAnswers()
	}
	return out
}

func defaultQuestionAnswers() []Answer {
	return []Answer{
		{ID: "yes", Label: "yes"},
		{ID: "no", Label: "no"},
	}
}

func questionAnswerIDs(node *FlowNode) map[string]bool {
	ids := map[string]bool{}
	for _, a := range questionAnswers(node) {
		ids[a.ID] = true
	}
	return ids
}

// questionLabelForID returns the display label for a chosen
// answer ID, so the chat context block shows "billing"
// rather than the opaque handle id. Falls back to the id.
func questionLabelForID(node *FlowNode, id string) string {
	for _, a := range questionAnswers(node) {
		if a.ID == id {
			return a.Label
		}
	}
	return id
}

// resolveQuestionBranch decides which outgoing handle wins
// and whether to jump back for a loop iteration. Returns the
// (possibly adjusted) decision and a jumpBack index (-1 means
// no loop). When a chosen answer is a back-edge and the
// iteration cap is hit, execution is forced down the first
// forward (non-back-edge) answer so the loop can exit.
func resolveQuestionBranch(
	node *FlowNode,
	decision string,
	outgoing []FlowEdge,
	backEdges map[string]bool,
	orderIdx map[string]int,
	iterCount map[string]int,
	deadEdges map[string]bool,
) (string, int) {
	var data QuestionData
	_ = json.Unmarshal(node.Data, &data)
	maxIter := data.MaxIterations
	if maxIter <= 0 || maxIter > QuestionMaxIterations {
		maxIter = QuestionMaxIterations
	}

	chosen := findEdgeByHandle(outgoing, decision)

	if chosen != nil && backEdges[chosen.ID] {
		if iterCount[node.ID] >= maxIter {
			forced := firstForwardHandle(outgoing, backEdges)
			if forced != "" {
				decision = forced
				chosen = findEdgeByHandle(outgoing, forced)
			} else {
				for _, e := range outgoing {
					deadEdges[e.ID] = true
				}
				return decision, -1
			}
		} else {
			iterCount[node.ID]++
		}
	}

	for _, e := range outgoing {
		if e.SourceHandle == decision {
			delete(deadEdges, e.ID)
		} else {
			deadEdges[e.ID] = true
		}
	}

	if chosen != nil && backEdges[chosen.ID] {
		return decision, orderIdx[chosen.Target]
	}
	return decision, -1
}

// firstForwardHandle returns the source handle of the first
// outgoing edge that is not a back-edge — the loop's exit.
func firstForwardHandle(
	outgoing []FlowEdge, backEdges map[string]bool,
) string {
	for _, e := range outgoing {
		if !backEdges[e.ID] {
			return e.SourceHandle
		}
	}
	return ""
}

func findEdgeByHandle(
	edges []FlowEdge, handle string,
) *FlowEdge {
	for i := range edges {
		if edges[i].SourceHandle == handle {
			return &edges[i]
		}
	}
	return nil
}

// resetLoopBody clears per-node state for nodes that will
// be re-executed on the next loop iteration, between the
// jump target and the looping question (inclusive). The
// looping node itself keeps its iteration counter.
func resetLoopBody(
	order []string,
	startIdx, endIdx int,
	produced map[string][]Message,
	skipped map[string]bool,
	deadEdges map[string]bool,
	iterCount map[string]int,
	outgoingEdges map[string][]FlowEdge,
	loopingNodeID string,
) {
	for i := startIdx; i <= endIdx; i++ {
		nid := order[i]
		delete(produced, nid)
		delete(skipped, nid)
		if nid != loopingNodeID {
			delete(iterCount, nid)
		}
		for _, e := range outgoingEdges[nid] {
			delete(deadEdges, e.ID)
		}
	}
}
