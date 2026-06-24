// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type React from "react";

export const nodeInputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.85em",
  padding: "2px 4px",
  outline: "none",
};

export const nodeInputClass = "nodrag nopan nowheel";
