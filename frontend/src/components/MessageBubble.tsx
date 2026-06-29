// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useState, useCallback, useMemo, useRef,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { closeOpenFences } from "../lib/markdown";
import { splitThinkingBlocks } from "../lib/thinking";
import { ThinkingBlock } from "./ThinkingBlock";
import { ContextBlock } from "./ContextBlock";
import type { Message } from "../hooks/useChat";

const CANDIDATE_LABELS: Record<string, string> = {
  llm: "LLM",
  subflow: "Subflow",
};

function labelFor(nodeType: string, index: number): string {
  const base = CANDIDATE_LABELS[nodeType] ?? nodeType;
  return `${base} ${index + 1}`;
}

interface MessageBubbleProps {
  message: Message;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  nodeLabels?: Record<string, string>;
}

export function MessageBubble({
  message,
  selectedNodeId,
  onSelectNode,
  nodeLabels,
}: MessageBubbleProps) {
  const is_user = message.role === "user";
  const answerCopyRef = useRef<CopyHandle | null>(null);
  const [activeCandidate, setActiveCandidate] = useState(0);

  const candidates = message.candidates ?? [];
  const hasTabs = candidates.length > 1;
  const displayContent = useMemo(() => {
    if (!hasTabs) return message.content;
    const c = candidates[activeCandidate];
    return c?.content ?? message.content;
  }, [hasTabs, candidates, activeCandidate, message.content]);

  const getAnswerText = useCallback(
    () =>
      splitThinkingBlocks(displayContent)
        .filter((s) => s.type === "text")
        .map((s) => s.content.trim())
        .join("\n\n"),
    [displayContent],
  );

  if (is_user) {
    return (
      <div
        style={{
          padding: "1rem 1.25rem",
          backgroundColor: "var(--bg-input)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: "0.35rem",
          }}
        >
          You
        </div>
        <div
          style={{
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: "0.35rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Assistant
        <CopyButton
          getText={getAnswerText}
          handleRef={answerCopyRef}
        />
      </div>

      {message.context?.map((ctx, i) => (
        <ContextBlock
          key={`ctx-${i}`}
          nodeId={ctx.node_id}
          nodeType={ctx.node_type}
          content={ctx.content}
          label={nodeLabels?.[ctx.node_id]}
          selected={selectedNodeId === ctx.node_id}
          onSelect={onSelectNode}
        />
      ))}

      {hasTabs && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "0.6rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {candidates.map((c, i) => (
            <button
              key={c.node_id}
              onClick={() => setActiveCandidate(i)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  i === activeCandidate
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                color:
                  i === activeCandidate
                    ? "var(--text)"
                    : "var(--text-secondary)",
                padding: "4px 10px",
                fontSize: "0.8rem",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
              title={c.node_type}
            >
              {labelFor(c.node_type, i)}
            </button>
          ))}
        </div>
      )}

      <div
        className="prose"
        style={{ cursor: "pointer" }}
        onClick={() => answerCopyRef.current?.trigger()}
      >
        {splitThinkingBlocks(displayContent).map(
          (segment, i) =>
            segment.type === "thinking" ? (
              <ThinkingBlock
                key={i}
                content={segment.content}
              />
            ) : (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                components={{ pre: PreBlock }}
              >
                {closeOpenFences(segment.content)}
              </ReactMarkdown>
            ),
        )}
      </div>

      {message.status === "truncated" && (
        <div
          style={{
            color: "var(--accent-warning)",
            fontStyle: "italic",
            marginTop: "0.5rem",
            fontSize: "0.85em",
          }}
        >
          Response truncated due to length
        </div>
      )}
    </div>
  );
}

export interface CopyHandle {
  trigger: () => void;
}

function CopyButton({
  getText,
  handleRef,
}: {
  getText: () => string;
  handleRef?: React.MutableRefObject<
    CopyHandle | null
  >;
}) {
  const [copied, setCopied] = useState(false);

  const doCopy = useCallback(() => {
    const text = getText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
    );
  }, [getText]);

  const ref = useRef<CopyHandle>({ trigger: doCopy });
  ref.current.trigger = doCopy;
  if (handleRef) handleRef.current = ref.current;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        doCopy();
      }}
      title="Copy"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: copied
          ? "var(--accent-success)"
          : "var(--text-secondary)",
        opacity: copied ? 1 : 0.5,
        fontSize: "0.9em",
        padding: "0.15rem",
        lineHeight: 1,
        borderRadius: "var(--radius-sm)",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!copied)
          e.currentTarget.style.opacity = "0.8";
      }}
      onMouseLeave={(e) => {
        if (!copied)
          e.currentTarget.style.opacity = "0.5";
      }}
    >
      {copied ? (
        <svg
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="9" y="9"
            width="13" height="13" rx="2"
          />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node))
    return node.map(extractText).join("");
  if (
    typeof node === "object" &&
    "props" in node &&
    node.props
  ) {
    return extractText(
      (node.props as { children?: ReactNode })
        .children,
    );
  }
  return "";
}

function PreBlock({
  children,
}: {
  children?: ReactNode;
}) {
  const copyRef = useRef<CopyHandle | null>(null);
  const getText = useCallback(
    () => extractText(children).replace(/\n$/, ""),
    [children],
  );
  return (
    <pre
      style={{ position: "relative", cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        copyRef.current?.trigger();
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0.25rem",
          right: "0.25rem",
        }}
      >
        <CopyButton
          getText={getText}
          handleRef={copyRef}
        />
      </div>
      {children}
    </pre>
  );
}
