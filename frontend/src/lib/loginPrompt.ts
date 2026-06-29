// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export type LoginPromptReason =
  | "prompts"
  | "publish"
  | "edit_flow"
  | "rate_limited";

type Listener = (reason: LoginPromptReason) => void;

const listeners = new Set<Listener>();

export function showLoginPrompt(reason: LoginPromptReason) {
  for (const l of listeners) l(reason);
}

export function subscribeLoginPrompt(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
