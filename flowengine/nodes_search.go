// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/1-Bart-1/openfastchat-core/brave"
	"github.com/1-Bart-1/openfastchat-core/coreconfig"
	"github.com/1-Bart-1/openfastchat-core/llmclient"
)

// webSearchToolParams is the JSON schema for the web_search
// tool the model calls. A single required query string.
var webSearchToolParams = json.RawMessage(`{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query as plain keywords."
    }
  },
  "required": ["query"]
}`)

// executeWebSearch no longer runs a search itself. It
// registers a web_search tool the downstream LLM node offers
// to the model; the model decides whether and what to search.
// The tool executor runs Brave when invoked and emits a
// node_done event so the results still render as a context
// block.
func executeWebSearch(
	_ context.Context, n NodeCtx,
) (NodeResult, error) {
	var data WebSearchData
	if err := json.Unmarshal(
		n.Node.Data, &data,
	); err != nil {
		return NodeResult{}, fmt.Errorf(
			"parse web_search data: %w", err,
		)
	}

	count := data.ResultCount
	if count <= 0 {
		count = coreconfig.WebSearchMaxResults
	}

	cfg := n.Config
	nodeID := n.NodeID
	emit := n.Emit
	showOutput := showOutputFlag(n.Node)

	def := llmclient.ToolDef{
		Type: "function",
		Function: llmclient.ToolFunction{
			Name: "web_search",
			Description: "Search the web for current or factual " +
				"information. Use only when the answer needs " +
				"up-to-date or external facts.",
			Parameters: webSearchToolParams,
		},
	}

	n.Config.RegisterTool(def, func(
		ctx context.Context, args string,
	) (string, error) {
		query := finalizeQuery(parseToolQuery(args))
		if query == "" {
			return "No search query provided.", nil
		}

		var charge brave.BillingHook
		if cfg.OnSearchCharged != nil {
			charge = func(endpoint string) {
				cfg.OnSearchCharged(ctx, endpoint, count)
			}
		}
		results, err := brave.Search(
			ctx, cfg.BraveAPIKey, query, count, charge,
		)
		if err != nil {
			return "", fmt.Errorf("web search: %w", err)
		}

		formatted := formatSearchResults(results)
		if emit != nil {
			preview := formatted
			if len(preview) > 200 {
				preview = preview[:200] + "..."
			}
			emit(StreamEvent{
				Type:          "node_done",
				NodeID:        nodeID,
				NodeType:      string(NodeWebSearch),
				Output:        formatted,
				OutputPreview: preview,
				ShowOutput:    showOutput,
			})
		}
		return formatted, nil
	})

	return NodeResult{}, nil
}

func parseToolQuery(args string) string {
	var parsed struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal([]byte(args), &parsed); err != nil {
		return ""
	}
	return parsed.Query
}

func formatSearchResults(results []brave.SearchResult) string {
	var sb strings.Builder
	sb.WriteString("Web search results:\n\n")
	for i, r := range results {
		if i > 0 {
			sb.WriteString("\n---\n")
		}
		fmt.Fprintf(
			&sb, "[%s](%s)\n%s",
			r.Title, r.URL, r.Snippet,
		)
	}
	return sb.String()
}

// finalizeQuery strips JSON/structural syntax that
// confuses search engines or inflates URL length when
// encoded, then clamps to the per-query char budget.
func finalizeQuery(q string) string {
	q = strings.NewReplacer(
		"{", " ", "}", " ",
		"[", " ", "]", " ",
		`"`, " ", "\\", " ",
		"\n", " ", "\r", " ", "\t", " ",
	).Replace(q)
	q = strings.Join(strings.Fields(q), " ")
	q = strings.TrimSpace(q)

	max := coreconfig.BraveMaxQueryChars
	if len(q) <= max {
		return q
	}
	cut := strings.LastIndex(q[:max], " ")
	if cut <= max/2 {
		cut = max
	}
	return strings.TrimSpace(q[:cut])
}
