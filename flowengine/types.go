// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import "encoding/json"

type NodeType string

const (
	NodeUserPrompt   NodeType = "user_prompt"
	NodeSystemPrompt NodeType = "system_prompt"
	NodeMsgHistory   NodeType = "msg_history"
	NodeWebSearch    NodeType = "web_search"
	NodeLLM          NodeType = "llm"
	NodeQuestion     NodeType = "question"
	NodeSubflow      NodeType = "subflow"
	NodeUserOutput   NodeType = "user_output"
	NodeFiles        NodeType = "files"
	NodeCompact      NodeType = "compact"
)

// legacyYesNoType is the old node-type string for what is
// now NodeQuestion. Flows persisted before the rename still
// carry it; normalizeLegacyNodeTypes rewrites it on load.
const legacyYesNoType NodeType = "yes_no"

// isChoiceNode reports whether a node type routes execution
// down one of several named answer handles (and so emits a
// branch decision and may close a loop). Only question
// qualifies today; new branching block types go here.
func isChoiceNode(t NodeType) bool {
	return t == NodeQuestion
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type FlowNode struct {
	ID       string          `json:"id"`
	Type     NodeType        `json:"type"`
	Position Position        `json:"position"`
	Data     json.RawMessage `json:"data"`
}

type FlowEdge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"`
}

type FlowDefinition struct {
	Nodes []FlowNode `json:"nodes"`
	Edges []FlowEdge `json:"edges"`
}

// Node-specific configuration parsed from Data.

type SystemPromptData struct {
	Text string `json:"text"`
}

type MsgHistoryData struct {
	MaxMessages int `json:"max_messages"`
}

// Message is the canonical role-tagged unit flowing
// between nodes, and also the type the handler uses to
// pre-load conversation history.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type WebSearchData struct {
	ResultCount int `json:"result_count"`
}

type LLMData struct {
	Model       string  `json:"model"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
}

// Answer is one branch of a question node. ID is the stable
// output-handle id (edges reference it); Label is the
// user-editable display text the classifier matches against.
// Keeping them separate lets the user rename a branch without
// detaching its edges.
type Answer struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type QuestionData struct {
	Question      string   `json:"question"`
	Answers       []Answer `json:"answers"`
	Model         string   `json:"model"`
	MaxIterations int      `json:"max_iterations"`
}

const QuestionMaxIterations = 10

type SubflowData struct {
	FlowID string `json:"flow_id"`
	Name   string `json:"name,omitempty"`
}

const SubflowMaxDepth = 5

type FilesData struct{}

type CompactData struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	ThresholdWords int    `json:"threshold_words"`
}

// CompactDefaultModel is the sentinel that means "use the
// server's COMPACT_MODEL env var, resolved at execute time".
const CompactDefaultModel = "default"

const CompactDefaultThresholdWords = 200

// Document is the engine-facing shape of an uploaded file.
// Loaded by the handler before Execute() and consumed by the
// files node.
type Document struct {
	Filename string
	Content  string
}

// nodeOutputFlag is used to parse the show_output field
// from any node's data JSON.
type nodeOutputFlag struct {
	ShowOutput *bool `json:"show_output"`
}

// StreamEvent is sent to the client during execution.
type StreamEvent struct {
	Type              string      `json:"type"`
	NodeID            string      `json:"node_id,omitempty"`
	NodeType          string      `json:"node_type,omitempty"`
	Delta             string      `json:"delta,omitempty"`
	Output            string      `json:"output,omitempty"`
	OutputPreview     string      `json:"output_preview,omitempty"`
	ShowOutput        bool        `json:"show_output,omitempty"`
	Message           string      `json:"message,omitempty"`
	UserError         bool        `json:"user_error,omitempty"`
	MessageID         string      `json:"message_id,omitempty"`
	Usage             any         `json:"usage,omitempty"`
	TotalCost         string      `json:"total_cost,omitempty"`
	RetrySeconds      int         `json:"retry_seconds,omitempty"`
	Source            string      `json:"source,omitempty"`
	Content           string      `json:"content,omitempty"`
	Branch            string      `json:"branch,omitempty"`
	Title             string      `json:"title,omitempty"`
	Candidates        []Candidate `json:"candidates,omitempty"`
	GuestLLMCallsUsed *int32      `json:"guest_llm_calls_used,omitempty"`
	GuestLimitReached bool        `json:"guest_limit_reached,omitempty"`
}
