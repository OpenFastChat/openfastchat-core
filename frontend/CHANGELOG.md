<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Changelog — frontend (`@openfastchat/ui`)

All notable changes to the `@openfastchat/ui` npm package.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This package versions independently of the `openfastchat-core` Go module: UI
releases are tagged `ui-vX.Y.Z` (`./scripts/release ui`), Go releases `vX.Y.Z`.
See [`../COMPATIBILITY.md`](../COMPATIBILITY.md) for which versions work together.

## [Unreleased]

## [v0.2.1] - 2026-08-04

### Fixed
- Match `repository.url` to the exact GitHub org case (`OpenFastChat`) so npm
  trusted-publishing provenance validation passes. `v0.2.0` failed to publish to
  npm for this reason; the package's first org release is `0.2.1`.

## [v0.2.0] - 2026-08-04

### Changed
- Repository moved into the `OpenFastChat` GitHub org; `repository.url` updated.
  The published package name (`@openfastchat/ui`) is unchanged.

## [v0.1.0] - 2026-08-04

### Added
- Carve the app shell into `ChatShell` with `ShellUser` slots.
- Marketplace browse view and shell hooks.
- Base theme shipped as `@openfastchat/ui/styles.css`.
- Package made publishable to npm with a `prepack` step that re-syncs
  `compactPrompt.md` from the canonical Go source.
