// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Mirror of the Go compact node's prompt.md, kept in the package so it ships
// self-contained; the prepack script re-syncs it from the canonical Go source.
import promptText from "./compactPrompt.md?raw";

export const COMPACT_DEFAULT_PROMPT = promptText.trim();
