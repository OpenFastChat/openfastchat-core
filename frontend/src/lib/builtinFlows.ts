// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { FlowDefinition } from "../hooks/useFlows";

export interface FlowOption {
  id: string;
  name: string;
  displayName: string;
  editable: boolean;
  definition: FlowDefinition;
}

export const EMPTY_FLOW_DEFINITION: FlowDefinition = {
  nodes: [],
  edges: [],
};

export const DEFAULT_FLOW_DEFINITION: FlowDefinition = {
  nodes: [
    {
      id: "prompt-1",
      type: "user_prompt",
      position: { x: 50, y: 200 },
      data: {},
    },
    {
      id: "history-1",
      type: "msg_history",
      position: { x: 50, y: 50 },
      data: { max_messages: 0 },
    },
    {
      id: "llm-1",
      type: "llm",
      position: { x: 300, y: 120 },
      data: { model: "", temperature: 0.7, max_tokens: 0 },
    },
    {
      id: "output-1",
      type: "user_output",
      position: { x: 570, y: 150 },
      data: {},
    },
  ],
  edges: [
    { id: "e-prompt-llm", source: "prompt-1", target: "llm-1" },
    { id: "e-history-llm", source: "history-1", target: "llm-1" },
    { id: "e-llm-output", source: "llm-1", target: "output-1" },
  ],
};
