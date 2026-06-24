// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { FlowDefinition } from "./useFlows";

const DRAFT_KEY_PREFIX = "flowDraft:";

function key(flowId: string) {
  return DRAFT_KEY_PREFIX + flowId;
}

export function loadFlowDraft(
  flowId: string,
): FlowDefinition | null {
  try {
    const raw = localStorage.getItem(key(flowId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlowDefinition;
    if (!parsed?.nodes || !parsed?.edges) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFlowDraft(
  flowId: string, def: FlowDefinition,
) {
  try {
    localStorage.setItem(
      key(flowId), JSON.stringify(def),
    );
  } catch {
    // quota / disabled storage — silently drop
  }
}

export function clearFlowDraft(flowId: string) {
  try {
    localStorage.removeItem(key(flowId));
  } catch {
    // no-op
  }
}
