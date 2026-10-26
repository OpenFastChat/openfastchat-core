// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package coreconfig

import (
	"sort"
	"strings"
	"unicode"

	"github.com/openfastchat/openfastchat-core/llmclient"
)

type ModelConfig struct {
	Label           string
	InputPricePerK  float64
	OutputPricePerK float64
	MaxTokens       int
}

// Models is populated at startup from every provider's API.
var Models = map[string]ModelConfig{}

// DefaultModelID is the model used when a request names none or one no
// provider serves.
const DefaultModelID = "openai/gpt-oss-120b"

// DefaultModel returns DefaultModelID when a provider serves it, else the
// lowest discovered model ID, or "" when no models are discovered.
func DefaultModel() string {
	if _, ok := Models[DefaultModelID]; ok {
		return DefaultModelID
	}
	ids := make([]string, 0, len(Models))
	for id := range Models {
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return ""
	}
	sort.Strings(ids)
	return ids[0]
}

var pricingOverrides = map[string][2]float64{}

func SetPricingOverrides(p map[string][2]float64) {
	if p == nil {
		pricingOverrides = map[string][2]float64{}
		return
	}
	pricingOverrides = p
}

// knownPricing has per-1K-token pricing for models we
// recognize. Pricing per 1K tokens {input, output},
// sourced from groq.com/pricing.
var knownPricing = map[string][2]float64{
	"llama-3.1-8b-instant":    {0.00005, 0.00008},
	"llama-3.1-70b-versatile": {0.00059, 0.00079},
	"llama-3.3-70b-versatile": {0.00059, 0.00079},
	"llama3-70b-8192":         {0.00059, 0.00079},
	"mixtral-8x7b-32768":      {0.00024, 0.00024},
	"gemma2-9b-it":            {0.00020, 0.00020},
	"meta-llama/llama-4-scout-17b-16e-instruct": {
		0.00011, 0.00034,
	},
	"qwen/qwen3-32b":                   {0.00029, 0.00059},
	"moonshotai/kimi-k2-instruct":      {0.00100, 0.00300},
	"moonshotai/kimi-k2-instruct-0905": {0.00100, 0.00300},
	"openai/gpt-oss-20b":               {0.000075, 0.00030},
	"openai/gpt-oss-120b":              {0.00015, 0.00060},
	"groq/compound":                    {0.00059, 0.00079},
	"groq/compound-mini":               {0.00024, 0.00024},
	"allam-2-7b":                       {0.00005, 0.00008},
	// DeepSeek direct (USD per 1K tokens, ≈ $0.43/$0.87 per 1M).
	"deepseek-v4-pro":          {0.00043, 0.00087},
	"deepseek-v4-pro-thinking": {0.00043, 0.00087},
}

// ModelEntry is one model discovered on a provider, tagged
// with the client that serves it.
type ModelEntry struct {
	ID        string
	OwnedBy   string
	MaxTokens int
	Client    llmclient.Client
}

// SetModels rebuilds the model catalog and the model→provider
// index from every provider's discovered models. On id
// collisions the first provider wins (provider order is the
// configured order, Groq first).
func SetModels(entries []ModelEntry) {
	next := make(map[string]ModelConfig, len(entries))
	index := make(map[string]llmclient.Client, len(entries))
	for _, e := range entries {
		if _, seen := next[e.ID]; seen {
			continue
		}
		input_price := FallbackInputPricePerK
		output_price := FallbackOutputPricePerK
		if prices, ok := knownPricing[e.ID]; ok {
			input_price = prices[0]
			output_price = prices[1]
		}
		if prices, ok := pricingOverrides[e.ID]; ok {
			input_price = prices[0]
			output_price = prices[1]
		}
		next[e.ID] = ModelConfig{
			Label:           labelFromID(e.ID, e.OwnedBy),
			InputPricePerK:  input_price,
			OutputPricePerK: output_price,
			MaxTokens:       e.MaxTokens,
		}
		index[e.ID] = e.Client
	}
	providerMu.Lock()
	modelProvider = index
	providerMu.Unlock()
	Models = next
}

func labelFromID(id, owner string) string {
	name := id
	if idx := strings.LastIndex(id, "/"); idx >= 0 {
		name = id[idx+1:]
	}
	parts := strings.Split(name, "-")
	for i, part := range parts {
		if isParamSize(part) {
			parts[i] = strings.ToUpper(part)
		} else {
			parts[i] = titleCase(part)
		}
	}
	return strings.Join(parts, " ")
}

func isParamSize(s string) bool {
	if len(s) < 2 {
		return false
	}
	last := s[len(s)-1]
	if last != 'b' && last != 'B' &&
		last != 'm' && last != 'M' &&
		last != 'e' && last != 'E' {
		return false
	}
	for _, ch := range s[:len(s)-1] {
		if !unicode.IsDigit(ch) && ch != '.' {
			return false
		}
	}
	return true
}

func titleCase(s string) string {
	if s == "" {
		return s
	}
	runes := []rune(s)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}
