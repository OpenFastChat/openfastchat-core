// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Subsequence fuzzy match: returns true if every char of
// `query` appears in `target` in order (case-insensitive,
// whitespace ignored).
export function fuzzyMatch(
  query: string,
  target: string,
): boolean {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length; ti++) {
    if (t[ti] === q[qi]) qi++;
    if (qi === q.length) return true;
  }
  return false;
}

// Match against any of the provided fields.
export function fuzzyMatchAny(
  query: string,
  fields: Array<string | null | undefined>,
): boolean {
  if (!query.trim()) return true;
  return fields.some((f) =>
    f ? fuzzyMatch(query, f) : false,
  );
}
