// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";

interface UseEditorShortcutsArgs {
  onUndo: () => void;
  onRedo: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

export function useEditorShortcuts({
  onUndo, onRedo, onCopy, onPaste,
}: UseEditorShortcutsArgs) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (
        (key === "z" && e.shiftKey) ||
        key === "y"
      ) {
        e.preventDefault();
        onRedo();
      } else if (key === "c" && onCopy) {
        onCopy();
      } else if (key === "v" && onPaste) {
        e.preventDefault();
        onPaste();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () =>
      window.removeEventListener("keydown", handler, true);
  }, [onUndo, onRedo, onCopy, onPaste]);
}
