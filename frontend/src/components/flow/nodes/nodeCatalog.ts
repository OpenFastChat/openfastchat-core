// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { NODE_DESCRIPTIONS } from "./nodeDescriptions";

export interface NodeCatalogEntry {
  type: string;
  label: string;
  description: string;
}

const PALETTE_LABELS: { type: string; label: string }[] = [
  { type: "system_prompt", label: "$ System Prompt" },
  { type: "msg_history", label: "~ History" },
  { type: "files", label: "& Files" },
  { type: "web_search", label: "@ Web Search" },
  { type: "llm", label: "# LLM" },
  { type: "question", label: "? Question" },
  { type: "compact", label: "% Compact" },
  { type: "subflow", label: "⊙ Subflow" },
];

export const NODE_CATALOG: NodeCatalogEntry[] = PALETTE_LABELS.map(
  ({ type, label }) => ({
    type,
    label,
    description: NODE_DESCRIPTIONS[type] ?? "",
  }),
);

export const ALL_NODE_TYPES: string[] = NODE_CATALOG.map((n) => n.type);

const LABELS_BY_TYPE: Record<string, string> = Object.fromEntries(
  NODE_CATALOG.map((n) => [n.type, n.label]),
);

export function nodeLabel(type: string): string {
  return LABELS_BY_TYPE[type] ?? type;
}
