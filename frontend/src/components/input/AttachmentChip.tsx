// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import { pillTruncate } from "../../lib/pillStyle";

interface Props {
  filename: string;
  onDelete: () => void;
}

export function AttachmentChip({ filename, onDelete }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onDelete}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={hovered ? `Remove ${filename}` : filename}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        backgroundColor: "var(--bg-input)",
        color: hovered
          ? "var(--accent-error)"
          : "var(--text-secondary)",
        border: `1px solid ${
          hovered ? "var(--accent-error)" : "var(--border)"
        }`,
        padding: "2px 10px",
        fontFamily: "var(--font-sans)",
        fontSize: "0.78rem",
        cursor: "pointer",
        borderRadius: "var(--radius-full)",
        ...pillTruncate,
      }}
    >
      {hovered ? (
        <X size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
      ) : (
        <Paperclip size={13} strokeWidth={1.75} style={{ flexShrink: 0 }} />
      )}
      <span style={pillTruncate}>{filename}</span>
    </button>
  );
}
