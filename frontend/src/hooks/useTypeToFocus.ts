// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, type RefObject } from "react";

// useTypeToFocus refocuses the given element when the user starts
// typing a printable character while focus is on body (or a non-input
// element). Modifiers and special keys are ignored.
export function useTypeToFocus(
  target: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      if (
        active === target.current ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key.length !== 1
      ) {
        return;
      }
      target.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target]);
}
