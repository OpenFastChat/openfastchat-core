<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# openfastchat-core

The open engine **and shared frontend** behind
[OpenFastChat](https://github.com/openfastchat/openfastchat), licensed
**AGPL-3.0-only**.

It carries no database, billing, or auth-secret concerns — those live in each
wrapper. Both wrappers (the self-host app and the proprietary hosted SaaS) build
on this core; they are siblings over core, not layered on each other.

## Backend — Go module `github.com/openfastchat/openfastchat-core`

- `flowengine/` — the flow DAG executor, validation, and stream events
- `llmclient/` — multi-provider OpenAI-compatible chat client with tool calls
- `compact/` — context compaction
- `brave/` — web-search client
- `crypto/` — AES-256-GCM for provider keys at rest
- `coreconfig/` — model registry, provider routing, and engine tuning knobs

Wrappers talk to the engine over the `flowengine.LLMClient` interface (the
billing/abuse layer is injected by the hosted wrapper; the self-host app injects
an unbilled client). Builds standalone (`go build ./...`), no external deps.

## Frontend — npm package `@openfastchat/ui` (`frontend/`)

The reusable React building blocks: the flow editor (`@xyflow/react`), chat UI,
node renderers, ndjson stream parsing, and the data hooks. `react`, `react-dom`,
`react-router-dom`, `@xyflow/react`, and `@tanstack/react-query` are
**peerDependencies** so each wrapper owns a single copy. Wrappers consume it via
pnpm during local staging (`link:../../openfastchat-core/frontend`) and as a
published version once open-sourced.

## License

AGPL-3.0-only. See [`LICENSES/`](./LICENSES). REUSE-compliant; run `reuse lint`.
