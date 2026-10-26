// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package coreconfig

import "testing"

func TestDefaultModelFallsBackToDiscoveredModel(t *testing.T) {
	t.Cleanup(func() { Models = map[string]ModelConfig{} })

	Models = map[string]ModelConfig{}
	if got := DefaultModel(); got != "" {
		t.Fatalf("no models: got %q, want empty", got)
	}

	Models = map[string]ModelConfig{"qwen/qwen3-32b": {}, "allam-2-7b": {}}
	if got := DefaultModel(); got != "allam-2-7b" {
		t.Fatalf("default not served: got %q, want lowest discovered ID", got)
	}

	Models[DefaultModelID] = ModelConfig{}
	if got := DefaultModel(); got != DefaultModelID {
		t.Fatalf("default served: got %q, want %q", got, DefaultModelID)
	}
}
