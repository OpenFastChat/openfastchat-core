// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	"github.com/1-Bart-1/openfastchat-core/llmclient"
)

// LLMClient is the interface flow nodes use for all LLM
// calls. The concrete impl lives in billedllm and records a
// token_events row for each call. Defining the interface
// here keeps flowengine free of a billing/DB dependency and
// makes the nodes trivially mockable.
type LLMClient interface {
	Complete(
		ctx context.Context,
		model string,
		messages []llmclient.Message,
		maxTokens int,
	) (string, error)

	CompleteRaw(
		ctx context.Context,
		model string,
		messages []llmclient.Message,
		tools []llmclient.ToolDef,
		maxTokens int,
	) (llmclient.Message, error)

	Stream(
		ctx context.Context,
		model string,
		messages []llmclient.Message,
		maxTokens int,
	) (<-chan string, <-chan error)

	TotalBilled() float64
}

type ExecuteConfig struct {
	LLM                LLMClient
	BraveAPIKey        string
	CompactModel       string
	Messages           []Message
	Documents          []Document
	OnLLMCost          func(cost float64) error
	OnSearchCharged    func(ctx context.Context, endpoint string, resultCount int)
	OnCompactInflation func(
		ctx context.Context,
		model string,
		originalWords, compactedWords int,
	)
	LoadFlow   func(flowID string) (FlowDefinition, error)
	RootFlowID string
	Streaming  bool
	streamed   *strings.Builder
	depth      int
	visited    map[string]bool
	tools      *toolRegistry
}

// Candidate is one answer produced by a direct source of user_output.
// When more than one exists the frontend renders tabs.
type Candidate struct {
	NodeID   string `json:"node_id"`
	NodeType string `json:"node_type"`
	Content  string `json:"content"`
}

type ExecuteResult struct {
	// TotalCost is the billed cost (raw groq × markup) for
	// the entire execution. Sourced from cfg.LLM at the
	// end of Execute since all per-call accounting lives
	// in the billedllm Recorder.
	TotalCost   float64
	FinalOutput string
	Candidates  []Candidate
}

// execState bundles the mutable run-state passed between helpers.
type execState struct {
	order              []string
	orderIdx           map[string]int
	backEdges          map[string]bool
	nodeByID           map[string]*FlowNode
	incoming           map[string][]FlowEdge
	outgoing           map[string][]FlowEdge
	outputInputs       map[string]bool
	primaryOutputInput string
	streamingLLMs      map[string]bool
	streamingDelegates map[string]bool
	streamClaimed      bool
	produced           map[string][]Message
	skipped            map[string]bool
	deadEdges          map[string]bool
	questionIter       map[string]int
}

func Execute(
	ctx context.Context,
	def FlowDefinition,
	userInput string,
	cfg ExecuteConfig,
	emit func(StreamEvent),
) (*ExecuteResult, error) {
	if err := Validate(def); err != nil {
		return nil, fmt.Errorf("invalid flow: %w", err)
	}
	if cfg.depth == 0 && cfg.RootFlowID != "" && cfg.visited == nil {
		cfg.visited = map[string]bool{cfg.RootFlowID: true}
	}
	if cfg.Streaming && cfg.streamed == nil {
		cfg.streamed = &strings.Builder{}
	}
	// Fresh tool registry per flow execution (subflows get
	// their own, so tools don't leak across the boundary).
	cfg.tools = newToolRegistry()
	state, err := prepareExecution(def, cfg.Streaming)
	if err != nil {
		return nil, err
	}
	result := &ExecuteResult{}

	for idx := 0; idx < len(state.order); {
		nodeID := state.order[idx]
		node := state.nodeByID[nodeID]
		if ctx.Err() != nil {
			if cfg.LLM != nil {
				result.TotalCost = cfg.LLM.TotalBilled()
			}
			return result, ctx.Err()
		}
		if shouldSkip(nodeID, node, state.incoming, state.nodeByID,
			state.skipped, state.deadEdges) {
			markSkipped(state, nodeID, node, emit)
			idx++
			continue
		}
		jumpBackIdx, err := runOneNode(
			ctx, nodeID, node, state, cfg, userInput,
			result, emit,
		)
		if err != nil {
			if cfg.LLM != nil {
				result.TotalCost = cfg.LLM.TotalBilled()
			}
			return result, err
		}
		if jumpBackIdx >= 0 {
			resetLoopBody(
				state.order, jumpBackIdx, idx,
				state.produced, state.skipped, state.deadEdges,
				state.questionIter, state.outgoing, nodeID,
			)
			idx = jumpBackIdx
			continue
		}
		idx++
	}

	collectFinalOutput(def, state, result)
	if cfg.LLM != nil {
		result.TotalCost = cfg.LLM.TotalBilled()
	}
	return result, nil
}

func prepareExecution(def FlowDefinition, streaming bool) (*execState, error) {
	order, backEdges, err := TopologicalSortWithBackEdges(def)
	if err != nil {
		return nil, fmt.Errorf("sort flow: %w", err)
	}
	orderIdx := make(map[string]int, len(order))
	for i, id := range order {
		orderIdx[id] = i
	}
	nodeByID := make(map[string]*FlowNode, len(def.Nodes))
	for i := range def.Nodes {
		nodeByID[def.Nodes[i].ID] = &def.Nodes[i]
	}
	incoming := make(map[string][]FlowEdge)
	outgoing := make(map[string][]FlowEdge)
	for _, e := range def.Edges {
		incoming[e.Target] = append(incoming[e.Target], e)
		outgoing[e.Source] = append(outgoing[e.Source], e)
	}
	outputInputs := FindOutputInputs(def)
	primary := selectPrimaryOutputInput(outputInputs, orderIdx)
	streamingLLMs := map[string]bool{}
	streamingDelegates := map[string]bool{}
	if streaming {
		for srcID := range outputInputs {
			llmID, delegateID := findStreamingSource(
				srcID, nodeByID, incoming, orderIdx,
			)
			if llmID != "" {
				streamingLLMs[llmID] = true
			}
			if delegateID != "" {
				streamingDelegates[delegateID] = true
			}
		}
	}
	return &execState{
		order:              order,
		orderIdx:           orderIdx,
		backEdges:          backEdges,
		nodeByID:           nodeByID,
		incoming:           incoming,
		outgoing:           outgoing,
		outputInputs:       outputInputs,
		primaryOutputInput: primary,
		streamingLLMs:      streamingLLMs,
		streamingDelegates: streamingDelegates,
		produced:           make(map[string][]Message),
		skipped:            make(map[string]bool),
		deadEdges:          make(map[string]bool),
		questionIter:       make(map[string]int),
	}, nil
}

// selectPrimaryOutputInput picks the earliest topo-order source of
// user_output so its tokens stream into the chat bubble; siblings
// compute silently and show up as candidate tabs in the final event.
func selectPrimaryOutputInput(
	outputInputs map[string]bool, orderIdx map[string]int,
) string {
	primary := ""
	idx := -1
	for srcID := range outputInputs {
		oi, ok := orderIdx[srcID]
		if !ok {
			continue
		}
		if idx == -1 || oi < idx {
			idx = oi
			primary = srcID
		}
	}
	return primary
}

// findStreamingSource walks back from one user_output input through
// pure passthrough nodes (question — a branch gate that produces no
// content of its own) to find the producer of the chat content.
// Returns either an LLM node id (direct streaming) or a subflow node
// id (delegate streaming, the subflow's own Execute call resolves its
// inner source). Returns ("", "") if the chain doesn't land on either
// — the legacy single-shot emit handles those. Called once per output
// input; the engine streams whichever resolved source runs live first.
func findStreamingSource(
	inputID string,
	nodeByID map[string]*FlowNode,
	incoming map[string][]FlowEdge,
	orderIdx map[string]int,
) (llmID, delegateID string) {
	cur := inputID
	guard := map[string]bool{}
	for cur != "" && !guard[cur] {
		guard[cur] = true
		node := nodeByID[cur]
		if node == nil {
			return "", ""
		}
		if node.Type == NodeLLM {
			return cur, ""
		}
		if node.Type == NodeSubflow {
			return "", cur
		}
		if node.Type != NodeQuestion {
			return "", ""
		}
		next := predictLastInputProducer(
			cur, nodeByID, incoming, orderIdx,
		)
		if next == "" || next == cur {
			return "", ""
		}
		cur = next
	}
	return "", ""
}

// predictLastInputProducer mirrors mergeInputs' sort: it returns the
// transitive ancestor that would land last in the merged input list
// (highest nodePriority, then latest topo order). Statically computed,
// without considering runtime skipped/deadEdges — that's a rare edge
// case and the runtime emit-dedupe handles divergence gracefully.
func predictLastInputProducer(
	targetID string,
	nodeByID map[string]*FlowNode,
	incoming map[string][]FlowEdge,
	orderIdx map[string]int,
) string {
	visited := map[string]bool{}
	var walk func(id string)
	var best string
	bestPri, bestTopo := -1, -1
	walk = func(id string) {
		for _, e := range incoming[id] {
			if visited[e.Source] {
				continue
			}
			visited[e.Source] = true
			anc := nodeByID[e.Source]
			if anc != nil {
				pri := nodePriority(anc.Type)
				topo := orderIdx[e.Source]
				if pri > bestPri ||
					(pri == bestPri && topo > bestTopo) {
					bestPri = pri
					bestTopo = topo
					best = e.Source
				}
			}
			walk(e.Source)
		}
	}
	walk(targetID)
	return best
}

func markSkipped(
	state *execState, nodeID string, node *FlowNode,
	emit func(StreamEvent),
) {
	state.skipped[nodeID] = true
	for _, e := range state.outgoing[nodeID] {
		state.deadEdges[e.ID] = true
	}
	emit(StreamEvent{
		Type: "node_skipped", NodeID: nodeID,
		NodeType: string(node.Type),
	})
}

// runOneNode executes a single node and emits its events. Returns
// jumpBackIdx >= 0 when a question branch wants to re-enter a loop body.
func runOneNode(
	ctx context.Context,
	nodeID string,
	node *FlowNode,
	state *execState,
	cfg ExecuteConfig,
	userInput string,
	result *ExecuteResult,
	emit func(StreamEvent),
) (int, error) {
	inputs := mergeInputs(
		nodeID, state.incoming, state.produced,
		state.skipped, state.deadEdges, state.orderIdx, state.nodeByID,
	)
	emit(StreamEvent{Type: "node_start", NodeID: nodeID})

	exec, ok := executors[node.Type]
	if !ok {
		err := fmt.Errorf("no executor for node type %s", node.Type)
		emit(StreamEvent{Type: "error", NodeID: nodeID, Message: err.Error()})
		return -1, err
	}
	isStreamingLLM := cfg.Streaming && !state.streamClaimed &&
		state.streamingLLMs[nodeID]
	isStreamingDelegate := cfg.Streaming && !state.streamClaimed &&
		state.streamingDelegates[nodeID]
	if isStreamingLLM || isStreamingDelegate {
		state.streamClaimed = true
	}
	nodeEmit := emit
	if isStreamingLLM && cfg.streamed != nil {
		streamed := cfg.streamed
		nodeEmit = func(ev StreamEvent) {
			if ev.Type == "token" {
				streamed.WriteString(ev.Delta)
			}
			emit(ev)
		}
	}
	res, execErr := exec(ctx, NodeCtx{
		Node:      node,
		NodeID:    nodeID,
		Inputs:    inputs,
		UserInput: userInput,
		Streaming: isStreamingLLM || isStreamingDelegate,
		Config:    cfg,
		Result:    result,
		Emit:      nodeEmit,
	})

	jumpBackIdx := -1
	if node.Type == NodeQuestion && execErr == nil {
		res.Decision, jumpBackIdx = resolveQuestionBranch(
			node, res.Decision,
			state.outgoing[nodeID], state.backEdges,
			state.orderIdx, state.questionIter, state.deadEdges,
		)
		emit(StreamEvent{
			Type: "branch", NodeID: nodeID, Branch: res.Decision,
		})
	}

	if execErr != nil {
		emitNodeError(emit, nodeID, execErr)
		return -1, execErr
	}
	if cfg.OnLLMCost != nil && cfg.LLM != nil {
		if err := cfg.OnLLMCost(cfg.LLM.TotalBilled()); err != nil {
			return -1, err
		}
	}

	state.produced[nodeID] = res.Produced
	alreadyStreamed := ""
	if cfg.streamed != nil {
		alreadyStreamed = cfg.streamed.String()
	}
	emitNodeDone(
		emit, nodeID, node, inputs, res,
		state.primaryOutputInput, alreadyStreamed,
	)
	return jumpBackIdx, nil
}

func emitNodeError(emit func(StreamEvent), nodeID string, execErr error) {
	msg := "an error occurred"
	userErr := false
	var ve *ValidationError
	if errors.As(execErr, &ve) {
		msg = ve.Message
		userErr = true
	}
	slog.Error("flow node error", "node", nodeID, "err", execErr)
	emit(StreamEvent{
		Type:      "error",
		NodeID:    nodeID,
		Message:   msg,
		UserError: userErr,
	})
}

func emitNodeDone(
	emit func(StreamEvent),
	nodeID string,
	node *FlowNode,
	inputs []Message,
	res NodeResult,
	primaryOutputInput string,
	alreadyStreamed string,
) {
	display := computeDisplay(node, inputs, res)
	if nodeID == primaryOutputInput && node.Type != NodeLLM && display != "" {
		if alreadyStreamed != display {
			emit(StreamEvent{Type: "token", Delta: display})
		}
	}
	preview := display
	if len(preview) > 200 {
		preview = preview[:200] + "..."
	}
	ev := StreamEvent{
		Type:          "node_done",
		NodeID:        nodeID,
		NodeType:      string(node.Type),
		Output:        display,
		OutputPreview: preview,
		ShowOutput:    showOutputFlag(node),
	}
	if isChoiceNode(node.Type) {
		ev.Branch = res.Decision
	}
	emit(ev)
}

// collectFinalOutput populates result.Candidates from the live sources
// feeding user_output, ordered by topo position, and sets FinalOutput
// to the first (earliest) candidate.
func collectFinalOutput(
	def FlowDefinition, state *execState, result *ExecuteResult,
) {
	var outputID string
	for _, n := range def.Nodes {
		if n.Type == NodeUserOutput {
			outputID = n.ID
			break
		}
	}
	if outputID == "" {
		return
	}
	type srcEntry struct {
		id string
		oi int
	}
	var srcs []srcEntry
	for _, e := range state.incoming[outputID] {
		if state.deadEdges[e.ID] || state.skipped[e.Source] {
			continue
		}
		if len(state.produced[e.Source]) == 0 {
			continue
		}
		srcs = append(srcs, srcEntry{
			id: e.Source, oi: state.orderIdx[e.Source],
		})
	}
	sort.SliceStable(srcs, func(i, j int) bool {
		return srcs[i].oi < srcs[j].oi
	})
	for _, s := range srcs {
		msgs := state.produced[s.id]
		result.Candidates = append(result.Candidates, Candidate{
			NodeID:   s.id,
			NodeType: string(state.nodeByID[s.id].Type),
			Content:  msgs[len(msgs)-1].Content,
		})
	}
	if len(result.Candidates) > 0 {
		result.FinalOutput = result.Candidates[0].Content
	}
}

// shouldSkip decides whether nodeID is bypassed this step.
// Two rules combine. Gate: a dead edge coming straight from a
// question node hard-blocks its target even when other inputs
// are live, so wiring a question answer into a node makes that
// node run only when the answer fires. AND: failing the gate, a
// node is skipped only when every incoming edge is dead or from
// a skipped source. user_output is never skipped.
func shouldSkip(
	nodeID string,
	node *FlowNode,
	incoming map[string][]FlowEdge,
	nodeByID map[string]*FlowNode,
	skipped, deadEdges map[string]bool,
) bool {
	if node.Type == NodeUserOutput {
		return false
	}
	in := incoming[nodeID]
	if len(in) == 0 {
		return false
	}
	for _, e := range in {
		if !deadEdges[e.ID] {
			continue
		}
		src := nodeByID[e.Source]
		if src != nil && isChoiceNode(src.Type) {
			return true
		}
	}
	for _, e := range in {
		if !deadEdges[e.ID] && !skipped[e.Source] {
			return false
		}
	}
	return true
}

// computeDisplay returns the string shown in both the chat collapsible
// and the edge-hover tooltip. Multi-message producers (files,
// msg_history, compact) join all produced messages so the user sees
// everything that flowed downstream. A question produces no data, so
// its display is the chosen answer's label.
func computeDisplay(
	node *FlowNode, inputs []Message, res NodeResult,
) string {
	if node.Type == NodeQuestion {
		return questionLabelForID(node, res.Decision)
	}
	if len(res.Produced) == 0 {
		return ""
	}
	if len(res.Produced) == 1 {
		return res.Produced[0].Content
	}
	var sb strings.Builder
	for i, m := range res.Produced {
		if i > 0 {
			sb.WriteString("\n\n---\n\n")
		}
		sb.WriteString(m.Content)
	}
	return sb.String()
}

func showOutputFlag(node *FlowNode) bool {
	var flag nodeOutputFlag
	_ = json.Unmarshal(node.Data, &flag)
	if flag.ShowOutput == nil {
		return false
	}
	return *flag.ShowOutput
}

func FindOutputInputs(def FlowDefinition) map[string]bool {
	var outputID string
	for _, n := range def.Nodes {
		if n.Type == NodeUserOutput {
			outputID = n.ID
			break
		}
	}
	result := make(map[string]bool)
	for _, e := range def.Edges {
		if e.Target == outputID {
			result[e.Source] = true
		}
	}
	return result
}
