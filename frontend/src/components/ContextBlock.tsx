// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";

interface ContextBlockProps {
  nodeId: string;
  nodeType: string;
  content: string;
  label?: string;
  selected?: boolean;
  onSelect?: (nodeId: string | null) => void;
}

const typeLabels: Record<string, string> = {
  web_search: "web search",
  system_prompt: "system prompt",
  llm: "llm",
  files: "files",
  compact: "compact",
};

export function ContextBlock({
  nodeId,
  nodeType,
  content,
  label,
  selected,
  onSelect,
}: ContextBlockProps) {
  const expanded = !!selected;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      ref.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selected]);

  const displayed = content.trim();
  const shownLabel =
    label?.trim() || typeLabels[nodeType] || nodeType;

  const handleClick = () => {
    onSelect?.(expanded ? null : nodeId);
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        color: "var(--text-secondary)",
        opacity: 0.7,
        fontStyle: "italic",
        cursor: "pointer",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        padding: "0.3rem 0",
        userSelect: expanded ? "text" : "none",
        borderLeft: selected
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        paddingLeft: selected ? "0.5rem" : "0.3rem",
        transition: "border-color 0.15s",
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
        {shownLabel}
      </span>
      <div
        style={{
          paddingLeft: "1.2rem",
          marginTop: "0.2rem",
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }),
        }}
      >
        {displayed}
      </div>
    </div>
  );
}
