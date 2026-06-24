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
    result_count?: number;
    show_output?: boolean;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    onDataChange?: NodeDataChange;
  };
}

export function WebSearchNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);

  return (
    <BaseNode
      label="Web Search"
      icon="@"
      nodeType="web_search"
      hasInput
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      showOutput={data.show_output}
      onToggleShowOutput={() => patch({ show_output: !data.show_output })}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span>results:</span>
        <input
          type="number"
          min={1}
          max={20}
          value={data.result_count ?? 5}
          onChange={(e) =>
            patch({ result_count: parseInt(e.target.value) || 5 })
          }
          className={nodeInputClass}
          style={{
            ...nodeInputStyle,
            width: "40px",
            textAlign: "center",
          }}
        />
      </div>
    </BaseNode>
  );
}
