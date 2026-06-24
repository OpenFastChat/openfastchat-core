// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BaseNode } from "./BaseNode";

interface Props {
  selected?: boolean;
  data: {
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
  };
}

export function UserOutputNode({
  selected, data,
}: Props) {
  return (
    <BaseNode
      label="User Output"
      icon="<"
      nodeType="user_output"
      hasInput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
    >
      <div style={{ color: "var(--text-secondary)" }}>
        response to user
      </div>
    </BaseNode>
  );
}
