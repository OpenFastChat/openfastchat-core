// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Edge, Node } from "@xyflow/react";
import type { FlowDefinition } from "../../hooks/useFlows";
import { COMPACT_DEFAULT_PROMPT } from "../../lib/compactDefaultPrompt";

export const DEFAULT_NODES: Node[] = [
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
];

export const DEFAULT_EDGES: Edge[] = [
  { id: "e-prompt-llm", source: "prompt-1", target: "llm-1" },
  { id: "e-history-llm", source: "history-1", target: "llm-1" },
  { id: "e-llm-output", source: "llm-1", target: "output-1" },
];

export const FIXED_TYPES = new Set(["user_prompt", "user_output"]);

// RUNTIME_DATA_KEYS is the set of keys that the FlowEditor injects into
// node.data at render time (models list, callbacks, execution flags).
// They must be stripped before persisting so they don't pollute the
// serialized flow definition.
const RUNTIME_DATA_KEYS = new Set([
  "models",
  "flowOptions",
  "onDataChange",
  "isActive",
  "isCompleted",
  "isError",
  "isSkipped",
  "candidateIndex",
]);

let nodeIdCounter = 100;

export function newNodeId(nodeType: string): string {
  return `${nodeType}-${++nodeIdCounter}`;
}

export function defaultNodeData(nodeType: string): Record<string, unknown> {
  switch (nodeType) {
    case "system_prompt":
      return { text: "", show_output: false };
    case "msg_history":
      return { max_messages: 0 };
    case "web_search":
      return { result_count: 5, show_output: true };
    case "llm":
      return {
        model: "",
        temperature: 0.7,
        max_tokens: 0,
        show_output: true,
      };
    case "question":
      return {
        question: "",
        answers: [
          { id: "yes", label: "yes" },
          { id: "no", label: "no" },
        ],
        model: "",
        max_iterations: 10,
        show_output: true,
      };
    case "subflow":
      return { flow_id: "", name: "Subflow", show_output: false };
    case "files":
      return { show_output: false };
    case "compact":
      return {
        model: "default",
        prompt: COMPACT_DEFAULT_PROMPT,
        threshold_words: 200,
        show_output: true,
      };
    default:
      return {};
  }
}

export function serializeFlow(
  nodes: Node[],
  edges: Edge[],
): FlowDefinition {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "user_prompt",
      position: n.position,
      data: Object.fromEntries(
        Object.entries(n.data).filter(
          ([k]) => !RUNTIME_DATA_KEYS.has(k),
        ),
      ),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    })),
  };
}

export function deserializeNodes(def: FlowDefinition): Node[] {
  return def.nodes.map((n) => ({
    id: n.id,
    type: n.type === "yes_no" ? "question" : n.type,
    position: n.position,
    data: n.data,
  }));
}

export function deserializeEdges(def: FlowDefinition): Edge[] {
  return def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
  }));
}

export function structuralFlowKey(def: FlowDefinition): string {
  const nodes = [...def.nodes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => ({
      id: n.id,
      type: n.type,
      data: sortedRecord(n.data),
    }));
  const edges = [...def.edges]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? "",
    }));
  return JSON.stringify({ nodes, edges });
}

function sortedRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value).sort()) {
    const v = value[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? sortedRecord(v as Record<string, unknown>)
        : v;
  }
  return out;
}
