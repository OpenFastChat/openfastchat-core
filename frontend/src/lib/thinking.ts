// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export type Segment =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string };

/**
 * Split message content into text and thinking segments.
 * Handles <think>...</think> blocks, including unclosed
 * blocks during streaming.
 */
export function splitThinkingBlocks(raw: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const open = raw.indexOf("<think>", cursor);
    if (open === -1) {
      const text = raw.slice(cursor);
      if (text) segments.push({ type: "text", content: text });
      break;
    }

    // Text before this <think> tag
    if (open > cursor) {
      segments.push({
        type: "text",
        content: raw.slice(cursor, open),
      });
    }

    const content_start = open + "<think>".length;
    const close = raw.indexOf("</think>", content_start);

    if (close === -1) {
      // Unclosed block (mid-stream) — treat rest as thinking
      const thinking = raw.slice(content_start);
      if (thinking) {
        segments.push({ type: "thinking", content: thinking });
      }
      cursor = raw.length;
    } else {
      const thinking = raw.slice(content_start, close);
      if (thinking) {
        segments.push({ type: "thinking", content: thinking });
      }
      cursor = close + "</think>".length;
    }
  }

  return segments;
}
