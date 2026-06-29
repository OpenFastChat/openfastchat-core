// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";

// useInputDraft persists the user's in-progress message to localStorage,
// keyed by the active chat/thread. Returns [value, setValue]. The
// stored draft is removed once the value becomes empty so a stale draft
// never resurfaces after a successful send.
export function useInputDraft(
  draftKey: string | undefined,
): [string, (next: string) => void] {
  const storageKey = draftKey ? `chatDraft:${draftKey}` : null;
  const [value, setValue] = useState(() => readDraft(storageKey));

  useEffect(() => {
    setValue(readDraft(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (value) {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Quota / private mode — silently ignore.
    }
  }, [storageKey, value]);

  return [value, setValue];
}

function readDraft(key: string | null): string {
  if (!key) return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
