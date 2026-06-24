// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { AutoTextarea } from "../../AutoTextarea";
import { BaseNode } from "./BaseNode";
import { useNodeData, type NodeDataChange } from "./useNodeData";

interface Props {
  id: string;
  selected?: boolean;
  data: {
    text?: string;
    show_output?: boolean;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    onDataChange?: NodeDataChange;
  };
}

export function SystemPromptNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);

  return (
    <BaseNode
      label="System Prompt"
      icon="$"
      nodeType="system_prompt"
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      showOutput={data.show_output}
      onToggleShowOutput={() => patch({ show_output: !data.show_output })}
    >
      <AutoTextarea
        value={data.text ?? ""}
        onChange={(e) => patch({ text: e.target.value })}
        placeholder="Enter system prompt..."
        rows={3}
        maxHeight={320}
        style={{
          width: "100%",
          backgroundColor: "var(--bg)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.85em",
          padding: "4px 6px",
          outline: "none",
        }}
      />
    </BaseNode>
  );
}
