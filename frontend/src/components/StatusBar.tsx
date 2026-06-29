// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { pillTruncate } from "../lib/pillStyle";

interface StatusBarProps {
  status: string;
  email: string;
  links?: { label: string; href: string }[];
  onContact?: () => void;
}

export function StatusBar({
  status,
  email,
  links = [],
  onContact,
}: StatusBarProps) {
  const is_active = status === "submitting" || status === "streaming";
  const is_error = status === "error";

  const dot_color = is_error
    ? "var(--accent-error)"
    : is_active
      ? "var(--accent-warning)"
      : "var(--accent-success)";

  const linkStyle: React.CSSProperties = {
    ...pillTruncate,
    color: "var(--text)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  };
  const contactStyle: React.CSSProperties = {
    ...linkStyle,
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    cursor: "pointer",
  };

  return (
    <div
      className="flex items-center px-3"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
        height: "1.75rem",
        fontSize: "0.75rem",
        gap: "0.75rem",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          minWidth: "5rem",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "var(--radius-full)",
            backgroundColor: dot_color,
            display: "inline-block",
            boxShadow: is_active ? `0 0 6px ${dot_color}` : "none",
          }}
        />
        {is_error ? "ERR" : is_active ? "LIVE" : "IDLE"}
      </span>
      <span style={{ ...pillTruncate, flex: 1 }}>{email}</span>
      {links.map((link) => (
        <a key={link.href} href={link.href} style={linkStyle}>
          {link.label}
        </a>
      ))}
      {onContact && (
        <button type="button" onClick={onContact} style={contactStyle}>
          Contact
        </button>
      )}
    </div>
  );
}
