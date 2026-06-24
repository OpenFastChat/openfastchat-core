// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BaseNode } from "./BaseNode";
import { useNodeData, type NodeDataChange } from "./useNodeData";

interface Props {
  id: string;
  selected?: boolean;
  data: {
    show_output?: boolean;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    onDataChange?: NodeDataChange;
  };
}

export function FilesNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);
  return (
    <BaseNode
      label="Files"
      icon="&"
      nodeType="files"
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      showOutput={data.show_output}
      onToggleShowOutput={() =>
        patch({ show_output: !data.show_output })
      }
    >
      <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>
        all uploaded docs
      </div>
    </BaseNode>
  );
}
