<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Compatibility

`openfastchat-core` (the Go module) and `@openfastchat/ui` (the npm package)
version independently — a UI change no longer bumps the engine and vice versa.
Their real coupling is the **backend HTTP API**: `@openfastchat/ui` renders a
frontend against the JSON/ndjson endpoints that a backend built on
`openfastchat-core` exposes. This file records which versions speak the same API.

## Matrix

| `@openfastchat/ui` | `openfastchat-core` backend | Notes |
| --- | --- | --- |
| `0.2.x` | `v0.2.x` | Current line. Same API contract. |

Use a UI with a backend on the **same minor** unless a row says otherwise. A
newer patch of either side stays compatible within its minor.

## Policy

- **Patch** (`x.y.Z`) — no API change; any patch of a minor works with any
  backend patch of the matching minor.
- **Minor** (`x.Y.0`) — additive API only; a newer backend serves an older UI.
  Bump the UI's minor when it starts requiring a newly added endpoint or field,
  and add a row here.
- **Major** (`X.0.0`) — breaking API change. Add a row, and state the minimum
  backend the new UI needs (or the backend range an older UI still works with).

When a release changes the API contract, update this matrix in the same PR.
