<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Changelog — frontend (`@openfastchat/ui`)

All notable changes to the `@openfastchat/ui` npm package.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This package and the Go module share one version: a single `vX.Y.Z` release tag
publishes both, so keep the top headers here and in the root `CHANGELOG.md` in
lockstep.

## [Unreleased]

## [v0.1.0] - 2026-08-04

### Added
- Carve the app shell into `ChatShell` with `ShellUser` slots.
- Marketplace browse view and shell hooks.
- Base theme shipped as `@openfastchat/ui/styles.css`.
- Package made publishable to npm with a `prepack` step that re-syncs
  `compactPrompt.md` from the canonical Go source.
