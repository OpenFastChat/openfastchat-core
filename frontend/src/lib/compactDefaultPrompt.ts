// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Single source of the compaction prompt: the same prompt.md the Go compact
// node embeds, imported raw so the editor's default matches the engine.
import promptText from "../../../compact/prompt.md?raw";

export const COMPACT_DEFAULT_PROMPT = promptText.trim();
