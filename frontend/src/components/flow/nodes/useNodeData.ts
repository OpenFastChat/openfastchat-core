// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback } from "react";

export type NodeDataChange = (
  nodeId: string,
  data: Record<string, unknown>,
) => void;

// useNodeData returns a stable `patch` callback that applies a partial
// data update for the given node. Encapsulates the id/onDataChange
// indirection every node component used to repeat by hand.
export function useNodeData(
  id: string,
  onDataChange: NodeDataChange | undefined,
) {
  return useCallback(
    (patch: Record<string, unknown>) => {
      onDataChange?.(id, patch);
    },
    [id, onDataChange],
  );
}

export function toggleBool<K extends string>(
  key: K,
  current: boolean | undefined,
): Record<K, boolean> {
  return { [key]: !current } as Record<K, boolean>;
}
