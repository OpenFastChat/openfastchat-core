// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package brave

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/openfastchat/openfastchat-core/coreconfig"
)

const (
	llmContextURL = "https://api.search.brave.com/res/v1/llm/context"
	webSearchURL  = "https://api.search.brave.com/res/v1/web/search"
)

var httpClient = &http.Client{}

type SearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// --- LLM context endpoint types ---

type llmGenericResult struct {
	Title    string   `json:"title"`
	URL      string   `json:"url"`
	Snippets []string `json:"snippets"`
}

type llmContextResponse struct {
	Grounding struct {
		Generic []llmGenericResult `json:"generic"`
	} `json:"grounding"`
}

// --- Web search fallback types ---

type webResult struct {
	Title         string   `json:"title"`
	URL           string   `json:"url"`
	Description   string   `json:"description"`
	ExtraSnippets []string `json:"extra_snippets"`
}

type webSearchResponse struct {
	Web struct {
		Results []webResult `json:"results"`
	} `json:"web"`
}

type BillingHook func(endpoint string)

// Search queries Brave's LLM context endpoint for rich,
// grounding-ready results. Falls back to the regular web
// search endpoint (with extra_snippets) on failure.
// Returns nil, nil if apiKey is empty.
func Search(
	ctx context.Context,
	apiKey, query string,
	count int,
	charge BillingHook,
) ([]SearchResult, error) {
	if apiKey == "" {
		return nil, nil
	}

	results, err := searchLLMContext(
		ctx, apiKey, query, count, charge,
	)
	if err != nil {
		slog.Warn(
			"brave llm/context failed, falling back",
			"err", err,
		)
		return searchWeb(ctx, apiKey, query, count, charge)
	}
	if len(results) == 0 {
		return searchWeb(ctx, apiKey, query, count, charge)
	}
	return results, nil
}

func searchLLMContext(
	ctx context.Context,
	apiKey, query string,
	count int,
	charge BillingHook,
) ([]SearchResult, error) {
	params := url.Values{}
	params.Set("q", query)
	params.Set("maximum_number_of_tokens",
		strconv.Itoa(coreconfig.LLMContextMaxTokens))
	params.Set("max_urls",
		strconv.Itoa(coreconfig.LLMContextMaxURLs))
	params.Set("max_snippets",
		strconv.Itoa(coreconfig.LLMContextMaxSnippets))
	params.Set("max_tokens_per_url",
		strconv.Itoa(coreconfig.LLMContextMaxTokensPerURL))
	params.Set("max_snippets_per_url",
		strconv.Itoa(coreconfig.LLMContextMaxSnippetsPerURL))
	params.Set("context_threshold_mode",
		coreconfig.LLMContextThresholdMode)

	req, err := http.NewRequestWithContext(
		ctx, http.MethodGet,
		llmContextURL+"?"+params.Encode(),
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"build llm context request: %w", err,
		)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set(
		"X-Subscription-Token", apiKey,
	)

	if charge != nil {
		charge("llm_context")
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"brave llm context request: %w", err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf(
			"brave llm context error %d: %s",
			resp.StatusCode, string(raw),
		)
	}

	var result llmContextResponse
	if err := json.NewDecoder(resp.Body).Decode(
		&result,
	); err != nil {
		return nil, fmt.Errorf(
			"decode llm context response: %w", err,
		)
	}

	generic := result.Grounding.Generic
	if count > 0 && len(generic) > count {
		generic = generic[:count]
	}

	results := make(
		[]SearchResult, 0, len(generic),
	)
	for _, r := range generic {
		results = append(results, SearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Snippet: strings.Join(r.Snippets, "\n"),
		})
	}
	return results, nil
}

func searchWeb(
	ctx context.Context,
	apiKey, query string,
	count int,
	charge BillingHook,
) ([]SearchResult, error) {
	params := url.Values{}
	params.Set("q", query)
	params.Set("count", strconv.Itoa(count))
	params.Set("extra_snippets", "true")

	req, err := http.NewRequestWithContext(
		ctx, http.MethodGet,
		webSearchURL+"?"+params.Encode(),
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"build brave request: %w", err,
		)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set(
		"X-Subscription-Token", apiKey,
	)

	if charge != nil {
		charge("web_search")
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"brave search request: %w", err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf(
			"brave search error %d: %s",
			resp.StatusCode, string(raw),
		)
	}

	var result webSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(
		&result,
	); err != nil {
		return nil, fmt.Errorf(
			"decode brave response: %w", err,
		)
	}

	results := make(
		[]SearchResult, 0, len(result.Web.Results),
	)
	for _, r := range result.Web.Results {
		snippet := r.Description
		if len(r.ExtraSnippets) > 0 {
			snippet += "\n" + strings.Join(
				r.ExtraSnippets, "\n",
			)
		}
		results = append(results, SearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Snippet: snippet,
		})
	}
	return results, nil
}
