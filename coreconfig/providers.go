// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Package coreconfig holds the engine-level configuration shared by every
// OpenFastChat wrapper: the OpenAI-compatible provider set, the model→provider
// routing index, the model registry, and the flow-engine tuning constants.
// It carries no billing, auth, or env-secret concerns — those live in each
// wrapper's own config.
package coreconfig

import (
	"sync"

	"github.com/1-Bart-1/openfastchat-core/llmclient"
)

// ProviderConfig describes one OpenAI-compatible backend.
type ProviderConfig struct {
	Name    string
	BaseURL string
	APIKey  string
}

// Client returns the llmclient for this provider.
func (p ProviderConfig) Client() llmclient.Client {
	return llmclient.Client{BaseURL: p.BaseURL, APIKey: p.APIKey}
}

// The active provider set plus a model→provider index, both
// rebuilt whenever providers or models refresh. ProviderFor
// resolves which backend serves a model at execute time.
var (
	providerMu    sync.RWMutex
	activeProvs   []ProviderConfig
	modelProvider = map[string]llmclient.Client{}
	defaultClient llmclient.Client
)

// SetActiveProviders replaces the live provider list and the
// default (first) client used for unknown/legacy model ids.
func SetActiveProviders(provs []ProviderConfig) {
	providerMu.Lock()
	defer providerMu.Unlock()
	activeProvs = append([]ProviderConfig(nil), provs...)
	if len(provs) > 0 {
		defaultClient = provs[0].Client()
	}
}

// ActiveProviders returns a copy of the live provider list.
func ActiveProviders() []ProviderConfig {
	providerMu.RLock()
	defer providerMu.RUnlock()
	return append([]ProviderConfig(nil), activeProvs...)
}

// ProviderFor returns the client serving model, falling back
// to the first provider for ids we haven't indexed (legacy
// bare ids in old flow definitions).
func ProviderFor(model string) llmclient.Client {
	providerMu.RLock()
	defer providerMu.RUnlock()
	if c, ok := modelProvider[model]; ok {
		return c
	}
	return defaultClient
}
