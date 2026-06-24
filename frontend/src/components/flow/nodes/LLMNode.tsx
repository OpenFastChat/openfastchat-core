// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BaseNode } from "./BaseNode";
import { nodeInputClass, nodeInputStyle } from "./styles";
import { useNodeData, type NodeDataChange } from "./useNodeData";

interface Props {
  id: string;
  selected?: boolean;
  data: {
    model?: string;
    max_tokens?: number;
    temperature?: number;
    show_output?: boolean;
    models?: Array<{ id: string; label: string }>;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    candidateIndex?: number;
    onDataChange?: NodeDataChange;
  };
}

export function LLMNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);
  const models = data.models ?? [];

  return (
    <BaseNode
      label="LLM"
      icon="#"
      nodeType="llm"
      hasInput
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      candidateIndex={data.candidateIndex}
      showOutput={data.show_output}
      onToggleShowOutput={() => patch({ show_output: !data.show_output })}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <select
          value={data.model ?? ""}
          onChange={(e) => patch({ model: e.target.value })}
          className={nodeInputClass}
          style={nodeInputStyle}
        >
          <option value="">default</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <div
          style={{
            display: "flex",
            gap: "4px",
            alignItems: "center",
          }}
        >
          <span>temp:</span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={data.temperature ?? 0.7}
            onChange={(e) =>
              patch({ temperature: parseFloat(e.target.value) || 0.7 })
            }
            className={nodeInputClass}
            style={{ ...nodeInputStyle, width: "50px" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: "4px",
            alignItems: "center",
          }}
        >
          <span>max:</span>
          <input
            type="number"
            min={0}
            step={256}
            value={data.max_tokens ?? 0}
            onChange={(e) =>
              patch({ max_tokens: parseInt(e.target.value) || 0 })
            }
            className={nodeInputClass}
            style={{ ...nodeInputStyle, width: "60px" }}
            placeholder="auto"
          />
        </div>
      </div>
    </BaseNode>
  );
}
