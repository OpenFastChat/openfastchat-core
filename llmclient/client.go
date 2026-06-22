// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package llmclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

// Client targets one OpenAI-compatible chat-completions
// provider. BaseURL is the API root (no trailing slash),
// e.g. "https://api.groq.com/openai/v1" or a self-hosted
// vLLM endpoint. APIKey is sent as a bearer token; empty
// means the endpoint needs no auth (local servers).
type Client struct {
	BaseURL string
	APIKey  string
}

var httpClient = &http.Client{}

// retryPattern matches "try again in X.XXs" in provider errors.
var retryPattern = regexp.MustCompile(
	`try again in (\d+(?:\.\d+)?)s`,
)

// RateLimitError is returned when the provider responds with 429.
type RateLimitError struct {
	RetrySeconds int
	Raw          string
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf(
		"provider rate limit: retry in %ds", e.RetrySeconds,
	)
}

func parseRateLimitError(body []byte) *RateLimitError {
	seconds := 30 // default fallback
	if m := retryPattern.FindSubmatch(body); len(m) > 1 {
		if f, err := strconv.ParseFloat(
			string(m[1]), 64,
		); err == nil {
			seconds = int(math.Ceil(f))
		}
	}
	return &RateLimitError{
		RetrySeconds: seconds,
		Raw:          string(body),
	}
}

// Message is one chat message. ToolCalls is populated on an
// assistant message that requested tools; ToolCallID + Name
// tag a tool-result message sent back to the model.
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

// ToolDef is a tool offered to the model in a request.
type ToolDef struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

type ToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// ToolCall is a tool invocation the model asked for.
type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type Usage struct {
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	FinishReason     string `json:"-"`
}

type requestBody struct {
	Model         string         `json:"model"`
	Messages      []Message      `json:"messages"`
	Stream        bool           `json:"stream"`
	MaxTokens     int            `json:"max_tokens,omitempty"`
	Tools         []ToolDef      `json:"tools,omitempty"`
	StreamOptions *streamOptions `json:"stream_options,omitempty"`
}

type streamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

type chunkChoice struct {
	Delta struct {
		Content string `json:"content"`
	} `json:"delta"`
	FinishReason *string `json:"finish_reason"`
}

type streamChunk struct {
	Choices []chunkChoice `json:"choices"`
	Usage   *Usage        `json:"usage"`
}

type ModelEntry struct {
	ID                  string `json:"id"`
	OwnedBy             string `json:"owned_by"`
	ContextWindow       int    `json:"context_window"`
	MaxCompletionTokens int    `json:"max_completion_tokens"`
}

type modelsResponse struct {
	Data []ModelEntry `json:"data"`
}

// skipPrefixes lists model ID prefixes that are not chat models.
var skipPrefixes = []string{
	"whisper",
	"canopylabs/orpheus",
	"meta-llama/llama-prompt-guard",
	"openai/gpt-oss-safeguard",
}

func isSkipped(id string) bool {
	for _, prefix := range skipPrefixes {
		if strings.HasPrefix(id, prefix) {
			return true
		}
	}
	return false
}

func (c Client) chatURL() string {
	return c.BaseURL + "/chat/completions"
}

func (c Client) modelsURL() string {
	return c.BaseURL + "/models"
}

func (c Client) setAuth(req *http.Request) {
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
}

// FetchModels returns all chat-capable models from the provider.
func (c Client) FetchModels() ([]ModelEntry, error) {
	req, err := http.NewRequest(http.MethodGet, c.modelsURL(), nil)
	if err != nil {
		return nil, fmt.Errorf("build models request: %w", err)
	}
	c.setAuth(req)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("models request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("models error %d: %s",
			resp.StatusCode, string(body))
	}

	var result modelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode models: %w", err)
	}

	var chat []ModelEntry
	for _, m := range result.Data {
		if m.ContextWindow < 1024 || isSkipped(m.ID) {
			continue
		}
		chat = append(chat, m)
	}
	return chat, nil
}

type completionResponse struct {
	Choices []struct {
		Message      Message `json:"message"`
		FinishReason string  `json:"finish_reason"`
	} `json:"choices"`
	Usage *Usage `json:"usage"`
}

// CompleteWithUsage runs a non-streaming completion and
// returns the assistant text plus token usage.
func (c Client) CompleteWithUsage(
	ctx context.Context,
	model string,
	messages []Message,
	maxTokens int,
) (string, Usage, error) {
	msg, usage, err := c.CompleteRaw(ctx, model, messages, nil, maxTokens)
	return strings.TrimSpace(msg.Content), usage, err
}

// CompleteRaw runs a non-streaming completion with optional
// tools and returns the full assistant message. When the
// model wants tools, the returned message's ToolCalls is
// non-empty and Content is usually blank.
func (c Client) CompleteRaw(
	ctx context.Context,
	model string,
	messages []Message,
	tools []ToolDef,
	maxTokens int,
) (Message, Usage, error) {
	var usage Usage
	body := requestBody{
		Model:     model,
		Messages:  messages,
		Stream:    false,
		MaxTokens: maxTokens,
		Tools:     tools,
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return Message{}, usage, fmt.Errorf(
			"marshal request: %w", err,
		)
	}

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, c.chatURL(),
		bytes.NewReader(encoded),
	)
	if err != nil {
		return Message{}, usage, fmt.Errorf(
			"build request: %w", err,
		)
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)

	resp, err := httpClient.Do(req)
	if err != nil {
		return Message{}, usage, fmt.Errorf(
			"provider request: %w", err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			return Message{}, usage, parseRateLimitError(raw)
		}
		return Message{}, usage, fmt.Errorf(
			"provider error %d: %s",
			resp.StatusCode, string(raw),
		)
	}

	var result completionResponse
	if err := json.NewDecoder(resp.Body).Decode(
		&result,
	); err != nil {
		return Message{}, usage, fmt.Errorf(
			"decode response: %w", err,
		)
	}
	if len(result.Choices) == 0 {
		return Message{}, usage, fmt.Errorf(
			"no choices in response",
		)
	}
	if result.Usage != nil {
		usage = *result.Usage
		usage.FinishReason = result.Choices[0].FinishReason
	}
	return result.Choices[0].Message, usage, nil
}

// Stream runs a streaming completion (no tools) and returns
// the content token channel, a usage channel, and an error
// channel.
func (c Client) Stream(
	ctx context.Context,
	model string,
	messages []Message,
	maxTokens int,
) (<-chan string, <-chan Usage, <-chan error) {
	tokens := make(chan string, 32)
	usageCh := make(chan Usage, 1)
	errs := make(chan error, 1)

	go func() {
		defer close(tokens)
		defer close(usageCh)
		defer close(errs)

		body := requestBody{
			Model:         model,
			Messages:      messages,
			Stream:        true,
			MaxTokens:     maxTokens,
			StreamOptions: &streamOptions{IncludeUsage: true},
		}
		encoded, err := json.Marshal(body)
		if err != nil {
			errs <- fmt.Errorf("marshal request: %w", err)
			return
		}

		req, err := http.NewRequestWithContext(ctx,
			http.MethodPost, c.chatURL(), bytes.NewReader(encoded))
		if err != nil {
			errs <- fmt.Errorf("build request: %w", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		c.setAuth(req)

		resp, err := httpClient.Do(req)
		if err != nil {
			errs <- fmt.Errorf("provider request: %w", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			if resp.StatusCode == http.StatusTooManyRequests {
				errs <- parseRateLimitError(body)
			} else {
				errs <- fmt.Errorf("provider error %d: %s",
					resp.StatusCode, string(body))
			}
			return
		}

		var finishReason string
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			default:
			}
			line := scanner.Text()
			if line == "data: [DONE]" {
				break
			}
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")

			var chunk streamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				errs <- fmt.Errorf("parse chunk: %w", err)
				return
			}

			if len(chunk.Choices) > 0 {
				if chunk.Choices[0].FinishReason != nil {
					finishReason =
						*chunk.Choices[0].FinishReason
				}
				if chunk.Choices[0].Delta.Content != "" {
					tokens <-
						chunk.Choices[0].Delta.Content
				}
			}
			if chunk.Usage != nil {
				u := *chunk.Usage
				u.FinishReason = finishReason
				usageCh <- u
			}
		}
		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			errs <- fmt.Errorf("scan stream: %w", err)
		}
	}()

	return tokens, usageCh, errs
}
