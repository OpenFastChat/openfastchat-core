<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Changelog — backend (Go module)

All notable changes to the `github.com/openfastchat/openfastchat-core` Go module.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This module and the `@openfastchat/ui` frontend share one version: a single
`vX.Y.Z` release tag publishes both, so keep the top headers here and in
`frontend/CHANGELOG.md` in lockstep.

## [Unreleased]

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
