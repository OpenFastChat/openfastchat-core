// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from "react";

/** Shared invariant for every pill, chip, and select in the UI:
 *  it never overflows its container — overlong text is clipped
 *  with an ellipsis instead. Spread into a pill's style object,
 *  or wrap dynamic text in a span carrying it. The `minWidth: 0`
 *  is what lets a pill shrink inside a flex row. */
export const pillTruncate: CSSProperties = {
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
