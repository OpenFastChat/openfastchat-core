// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";

interface ThinkingBlockProps {
  content: string;
}

function collapsedPreview(content: string): string {
  const lines = content
    .trim()
    .split("\n")
    .filter(Boolean);
  if (lines.length <= 2) return lines.join("\n");
  return `${lines[0]}\n  ...\n${lines[lines.length - 1]}`;
}

export function ThinkingBlock({
  content,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const displayed = expanded
    ? content.trim()
    : collapsedPreview(content);

  return (
    <div
      onClick={() => setExpanded((prev) => !prev)}
      style={{
        color: "var(--text-secondary)",
        opacity: 0.7,
        fontStyle: "italic",
        cursor: "pointer",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        padding: "0.3rem 0",
        userSelect: expanded ? "text" : "none",
      }}
      title={
        expanded
          ? "Click to collapse"
          : "Click to expand"
      }
    >
      <span
        style={{
          fontSize: "0.8em",
          marginRight: "0.4rem",
        }}
      >
        {expanded ? "\u25BC" : "\u25B6"}
      </span>
      <span style={{ fontSize: "0.85em" }}>
        thinking
      </span>
      <div
        style={{
          paddingLeft: "1.2rem",
          marginTop: "0.2rem",
        }}
      >
        {displayed}
      </div>
    </div>
  );
}
