// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { pillTruncate } from "../lib/pillStyle";

/**
 * Shared header-pill box. Every pill in the header (Chat / Flows /
 * Marketplace toggles, Sign in, balance, etc.) spreads this so the
 * rendered box is byte-identical regardless of whether the element is
 * a button, anchor, or span.
 */
export const pill: React.CSSProperties = {
  ...pillTruncate,
  backgroundColor: "var(--pill-bg)",
  color: "var(--text)",
  border: "1px solid var(--pill-border)",
  padding: "0 14px",
  height: "32px",
  fontFamily: "var(--font-sans)",
  fontSize: "0.8rem",
  fontWeight: 500,
  borderRadius: "var(--radius-full)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  boxSizing: "border-box",
  textDecoration: "none",
  cursor: "pointer",
};

/** Pill style toggled to the accent colour when active. */
export function activePillStyle(active: boolean): React.CSSProperties {
  return {
    ...pill,
    backgroundColor: active ? "var(--accent)" : pill.backgroundColor,
    color: active ? "#fff" : pill.color,
    borderColor: active ? "var(--accent)" : "var(--pill-border)",
  };
}

/** Absolutely-positioned dropdown panel anchored to one side. */
export function menuPanel(
  side: "left" | "right",
  minWidth: string,
): React.CSSProperties {
  return {
    position: "absolute",
    [side]: 0,
    marginTop: "4px",
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    zIndex: 10,
    minWidth,
    overflow: "hidden",
  };
}

export function MenuDivider() {
  return <div style={{ borderTop: "1px solid var(--border)" }} />;
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  border: "none",
  fontFamily: "var(--font-sans)",
  fontSize: "0.85rem",
  cursor: "pointer",
  textDecoration: "none",
  boxSizing: "border-box",
};

export function MenuButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...menuItemStyle,
        backgroundColor: hovered ? "var(--bg-hover)" : "transparent",
        color: danger ? "var(--accent-error)" : "var(--text)",
      }}
    >
      {label}
    </button>
  );
}

export function MenuLink({
  label,
  href,
  accent,
  onSelect,
}: {
  label: string;
  href: string;
  accent?: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...menuItemStyle,
        backgroundColor: hovered ? "var(--bg-hover)" : "transparent",
        color: accent ? "var(--accent-text)" : "var(--text)",
      }}
    >
      {label}
    </a>
  );
}
