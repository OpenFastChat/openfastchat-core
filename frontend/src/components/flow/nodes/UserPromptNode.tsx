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

export function UserPromptNode({
  selected, data,
}: Props) {
  return (
    <BaseNode
      label="User Prompt"
      icon=">"
      nodeType="user_prompt"
      hasOutput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
    >
      <div style={{ color: "var(--text-secondary)" }}>
        input from user
      </div>
    </BaseNode>
  );
}
