<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# openfastchat-core

The open engine behind [OpenFastChat](https://github.com/1-Bart-1/openfastchat),
licensed **AGPL-3.0-only**.

A pure library — no database, no HTTP server, no billing. It is consumed by the
self-host app and the hosted wrapper over the `flowengine.LLMClient` interface.

Packages (carved in from the original monolith):

- `flowengine/` — the flow DAG executor, validation, and stream events
- `llmclient/` — multi-provider OpenAI-compatible chat client with tool calls
- `compact/` — context compaction
- `brave/` — web-search client
- `crypto/` — AES-256-GCM for provider keys at rest
- `coreconfig/` — model registry, provider routing, and engine tuning knobs

## License

AGPL-3.0-only. See [`LICENSES/`](./LICENSES). REUSE-compliant; run `reuse lint`.
