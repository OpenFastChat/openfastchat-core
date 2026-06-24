// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BaseNode } from "./BaseNode";
import { nodeInputClass, nodeInputStyle } from "./styles";
import { useNodeData, type NodeDataChange } from "./useNodeData";
import { COMPACT_DEFAULT_PROMPT } from "../../../lib/compactDefaultPrompt";

interface Props {
  id: string;
  selected?: boolean;
  data: {
    model?: string;
    prompt?: string;
    threshold_words?: number;
    show_output?: boolean;
    models?: Array<{ id: string; label: string }>;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    onDataChange?: NodeDataChange;
  };
}

export function CompactNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);
  const models = data.models ?? [];

  return (
    <BaseNode
      label="Compact"
      icon="%"
      nodeType="compact"
      hasInput
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      showOutput={data.show_output}
      onToggleShowOutput={() => patch({ show_output: !data.show_output })}
      maxWidth="320px"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <select
          value={data.model ?? "default"}
          onChange={(e) => patch({ model: e.target.value })}
          className={nodeInputClass}
          style={nodeInputStyle}
        >
          <option value="default">default</option>
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
          <span>above:</span>
          <input
            type="number"
            min={1}
            step={50}
            value={data.threshold_words ?? 200}
            onChange={(e) =>
              patch({
                threshold_words:
                  parseInt(e.target.value) || 200,
              })
            }
            className={nodeInputClass}
            style={{ ...nodeInputStyle, width: "60px" }}
            title="Skip messages with fewer words than this"
          />
          <span>words</span>
        </div>
        <textarea
          value={data.prompt ?? COMPACT_DEFAULT_PROMPT}
          onChange={(e) => patch({ prompt: e.target.value })}
          rows={5}
          className={nodeInputClass}
          style={{
            ...nodeInputStyle,
            resize: "vertical",
            fontFamily: "var(--font-sans)",
            lineHeight: 1.4,
            minHeight: "5em",
          }}
        />
      </div>
    </BaseNode>
  );
}
