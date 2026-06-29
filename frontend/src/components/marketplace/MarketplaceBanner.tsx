// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { pillTruncate } from "../../lib/pillStyle";

interface Action {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface Props {
  label: string;
  actions: Action[];
}

export function MarketplaceBanner({
  label,
  actions,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <span
        style={{
          color: "var(--text)",
          fontSize: "0.85rem",
          fontWeight: 500,
          flex: 1,
          ...pillTruncate,
        }}
        title={label}
      >
        {label}
      </span>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          style={{
            backgroundColor: a.primary
              ? "var(--accent)"
              : "var(--bg-input)",
            color: a.primary ? "#fff" : "var(--text)",
            border: a.primary
              ? "1px solid var(--accent)"
              : "1px solid var(--border)",
            padding: "4px 12px",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
            borderRadius: "var(--radius-full)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
