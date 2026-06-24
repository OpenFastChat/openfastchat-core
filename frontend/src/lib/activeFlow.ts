// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export type ActiveFlow =
  | { kind: "user"; id: string }
  | { kind: "marketplace_single"; id: string }
  | { kind: "marketplace_multi"; ids: string[] };

const STORAGE_KEY = "activeFlow";
const LEGACY_KEY = "activeFlowId";

export function loadActiveFlow(): ActiveFlow | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ActiveFlow;
      if (
        parsed &&
        (parsed.kind === "user" ||
          parsed.kind === "marketplace_single" ||
          parsed.kind === "marketplace_multi")
      ) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    return { kind: "user", id: legacy };
  }
  return null;
}

export function saveActiveFlow(af: ActiveFlow) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(af));
  if (af.kind === "user") {
    localStorage.setItem(LEGACY_KEY, af.id);
  } else {
    localStorage.removeItem(LEGACY_KEY);
  }
}
