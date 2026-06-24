// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BaseNode } from "./BaseNode";
import { useNodeData, type NodeDataChange } from "./useNodeData";

interface Props {
  id: string;
  selected?: boolean;
  data: {
    flow_id?: string;
    name?: string;
    show_output?: boolean;
    flowOptions?: Array<{ id: string; name: string }>;
    onDataChange?: NodeDataChange;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    candidateIndex?: number;
  };
}

export function SubflowNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);
  const options = data.flowOptions ?? [];

  const externalName =
    data.flow_id && !options.some((f) => f.id === data.flow_id)
      ? data.name ?? "External flow"
      : null;

  return (
    <BaseNode
      label="Subflow"
      icon="⊙"
      nodeType="subflow"
      hasInput
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      candidateIndex={data.candidateIndex}
    >
      {externalName ? (
        <div
          style={{
            width: "100%",
            backgroundColor: "var(--bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8em",
            padding: "3px 6px",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={externalName}
        >
          {externalName}
        </div>
      ) : (
        <select
          value={data.flow_id ?? ""}
          onChange={(e) => {
            const flowId = e.target.value;
            const picked = options.find((f) => f.id === flowId);
            patch({ flow_id: flowId, name: picked?.name ?? "Subflow" });
          }}
          className="nodrag"
          style={{
            width: "100%",
            backgroundColor: "var(--bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8em",
            padding: "3px 6px",
            outline: "none",
          }}
        >
          <option value="" disabled>
            Pick a flow…
          </option>
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}
    </BaseNode>
  );
}
