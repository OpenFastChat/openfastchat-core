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
    max_messages?: number;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    onDataChange?: NodeDataChange;
  };
}

export function MsgHistoryNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);
  return (
    <BaseNode
      label="History"
      icon="~"
      nodeType="msg_history"
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
    >
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
          step={1}
          value={data.max_messages || ""}
          onChange={(e) =>
            patch({ max_messages: parseInt(e.target.value) || 0 })
          }
          className={nodeInputClass}
          style={{ ...nodeInputStyle, width: "70px" }}
          placeholder="no limit"
          title="0 or empty = no limit"
        />
      </div>
    </BaseNode>
  );
}
