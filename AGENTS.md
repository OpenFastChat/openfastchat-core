<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# AGENTS.md

Shared engine + UI (AGPL) that both wrappers build on. Part of the OpenFastChat
workspace — see `../AGENTS.md` for the layout.

- Go module `github.com/1-Bart-1/openfastchat-core`: flowengine, llmclient,
  compact, brave, crypto, coreconfig, handler, middleware, store.
- React UI `@openfastchat/ui` in `frontend/` (source-distributed, consumed via a
  pnpm `link:` by the wrappers).
- Engine/UI behavior changes belong here, not in a wrapper. Keep it free of
  db / billing / auth-secret concerns — those live in each wrapper.
