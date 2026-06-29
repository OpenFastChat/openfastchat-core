// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { FlowDefinition } from "../hooks/useFlows";

export function buildComparisonDefinition(
  flowIds: string[],
  labels?: Record<string, string>,
): FlowDefinition {
  const inputId = "input";
  const outputId = "output";
  const baseX = 320;
  const stepY = 140;

  const subflowNodes = flowIds.map((id, i) => ({
    id: `sub_${i}`,
    type: "subflow",
    position: { x: baseX, y: 50 + i * stepY },
    data: {
      flow_id: id,
      name: labels?.[id] ?? `Flow ${i + 1}`,
      show_output: true,
    } as Record<string, unknown>,
  }));

  const nodes = [
    {
      id: inputId,
      type: "user_prompt",
      position: { x: 50, y: 200 },
      data: {},
    },
    ...subflowNodes,
    {
      id: outputId,
      type: "user_output",
      position: { x: 640, y: 200 },
      data: {},
    },
  ];

  const edges = subflowNodes.flatMap((n, i) => [
    {
      id: `e_in_${i}`,
      source: inputId,
      target: n.id,
    },
    {
      id: `e_out_${i}`,
      source: n.id,
      target: outputId,
    },
  ]);

  return { nodes, edges };
}
