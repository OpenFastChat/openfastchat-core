// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
// SPDX-License-Identifier: AGPL-3.0-only

package coreconfig

// DefaultMaxUploadSizeBytes caps document uploads (10 MiB).
const DefaultMaxUploadSizeBytes = 10 * 1024 * 1024

// HandlerConfig is the engine-side configuration the shared HTTP handlers need.
// Wrappers build it from their own environment: hosted from its config.Config,
// self-host from env vars. Billing, auth secrets, and abuse limits are NOT
// here — they stay in each wrapper.
type HandlerConfig struct {
	// BraveAPIKey enables the web-search node; empty disables search.
	BraveAPIKey string
	// CompactModel is the model used for context compaction and auto-titles.
	CompactModel string
	// TrustForwardedIP reads the client IP from X-Forwarded-For (only behind a
	// trusted proxy).
	TrustForwardedIP bool
	// MaxUploadSizeBytes caps a single document upload.
	MaxUploadSizeBytes int64
	// FrontendShellPath is the built SPA index.html, used for per-flow meta-tag
	// injection on /flow/{id}.
	FrontendShellPath string
}
