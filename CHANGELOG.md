<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Changelog — backend (Go module)

All notable changes to the `github.com/openfastchat/openfastchat-core` Go module.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This module versions independently of the `@openfastchat/ui` frontend package:
Go releases are tagged `vX.Y.Z` (`./scripts/release go`), UI releases `ui-vX.Y.Z`.
See [`COMPATIBILITY.md`](COMPATIBILITY.md) for which versions work together.

## [Unreleased]

## [v0.2.2] - 2026-10-26

### Fixed
- Fall back to a model a provider actually serves (`coreconfig.DefaultModel`:
  `openai/gpt-oss-120b`, else the first discovered model) instead of the
  hardcoded, retired `llama-3.3-70b-versatile`, which made every node without a
  valid model fail with a provider 404.

### Added
- `/api/models` flags the default model with `"default": true`.

## [v0.2.1] - 2026-08-04

### Changed
- Version bump only, to keep the Go module and `@openfastchat/ui` in lockstep
  after the frontend's npm-provenance fix. No backend changes since `v0.2.0`.

## [v0.2.0] - 2026-08-04

### Changed
- Moved the repository into the `OpenFastChat` GitHub org. The Go module path is
  now `github.com/openfastchat/openfastchat-core` (was
  `github.com/1-Bart-1/openfastchat-core`) — update imports and require lines.

## [v0.1.0] - 2026-08-04

### Added
- Shared-schema `store` package with squashed migrations for the open-core split.
- Shared `middleware`, `moderation`, and `usernames` packages.
- Shared HTTP `handler` layer with a pluggable `Billing` seam.
- Provider admin moved into core.
- `crypto` helpers and `coreconfig` shared configuration.
- `flowengine` and `llmclient` packages backing the flow-based chat codepath.
