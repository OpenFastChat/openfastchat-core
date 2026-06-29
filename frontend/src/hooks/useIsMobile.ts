// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) =>
      setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () =>
      mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}

/** True when the screen is too narrow for a
 *  side-by-side chat + flow editor split. */
export function useIsNarrow(): boolean {
  return useMediaQuery("(max-width: 1024px)");
}
