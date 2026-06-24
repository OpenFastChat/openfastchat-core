// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Public API of @openfastchat/ui — the shared, AGPL frontend building blocks
// (flow editor, chat UI, node renderers, stream parsing, data hooks) consumed
// by the self-host and hosted wrappers. Grows as packages are carved in.

export * from "./lib/stream";
export * from "./lib/welcomeThread";
export * from "./lib/compactDefaultPrompt";
