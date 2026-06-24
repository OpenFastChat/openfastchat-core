// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export type NDJsonMessage =
  | { type: "user_saved"; message_id: string }
  | { type: "token"; delta: string }
  | { type: "done"; message_id: string; content?: string;
      usage: unknown; truncated?: boolean;
      candidates?: {
        node_id: string;
        node_type: string;
        content: string;
      }[] }
  | { type: "node_done"; node_id: string;
      node_type: string; output: string;
      show_output: boolean; output_preview: string;
      branch?: string }
  | { type: "node_skipped"; node_id: string;
      node_type: string }
  | { type: "branch"; node_id: string; branch: string }
  | { type: "thread_renamed"; title: string }
  | { type: "flow_finished" }
  | { type: "error"; message: string; node_id?: string;
      user_error?: boolean }
  | { type: "rate_limit"; retry_seconds: number }
  | { type: "rag_context"; source: string;
      content: string }
  | { type: "guest_llm_calls"; guest_llm_calls_used: number;
      guest_limit_reached?: boolean };

export async function* streamNDJSON(
  response: Response
): AsyncGenerator<NDJsonMessage> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        yield JSON.parse(trimmed) as NDJsonMessage;
      }
    }

    // Flush any bytes held by the decoder
    buffer += decoder.decode();

    // Parse any remaining complete lines in buffer
    const remaining = buffer.split("\n");
    for (const line of remaining) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      yield JSON.parse(trimmed) as NDJsonMessage;
    }
  } finally {
    reader.releaseLock();
  }
}
