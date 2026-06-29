// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useLayoutEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ChatStatus, Message } from "../hooks/useChat";

interface ChatWindowProps {
  threadId: string;
  messages: Message[];
  status: ChatStatus;
  initialScrollFraction: number | null;
  onScrollChange: (fraction: number | null) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  nodeLabels?: Record<string, string>;
}

const NEAR_BOTTOM_PX = 80;
const FAR_FROM_BOTTOM_PX = 120;

export function ChatWindow({
  threadId,
  messages,
  status,
  initialScrollFraction,
  onScrollChange,
  selectedNodeId,
  onSelectNode,
  nodeLabels,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const modeRef = useRef<"tail" | "manual">("tail");
  const restoredThreadRef = useRef<string>("");
  const lastSetTopRef = useRef<number>(-1);
  const animationRef = useRef<number | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<number | null>(null);

  const isStreaming =
    status === "submitting" || status === "streaming";

  const cancelScrollAnimation = () => {
    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const snapToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    cancelScrollAnimation();
    const top = el.scrollHeight - el.clientHeight;
    el.scrollTop = top;
    lastSetTopRef.current = top;
  };

  const animateToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (animationRef.current != null) return;
    const step = () => {
      animationRef.current = null;
      const cur = scrollRef.current;
      if (!cur) return;
      if (modeRef.current !== "tail") return;
      const target = cur.scrollHeight - cur.clientHeight;
      const delta = target - cur.scrollTop;
      if (Math.abs(delta) < 0.5) {
        cur.scrollTop = target;
        lastSetTopRef.current = target;
        return;
      }
      const next = cur.scrollTop + delta * 0.18;
      cur.scrollTop = next;
      lastSetTopRef.current = next;
      animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
  };

  useEffect(() => cancelScrollAnimation, []);

  useEffect(() => {
    if (isStreaming) return;
    restoredThreadRef.current = "";
  }, [threadId, isStreaming]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!threadId) return;
    if (isStreaming) return;
    if (messages.length === 0) return;
    if (restoredThreadRef.current === threadId) return;
    restoredThreadRef.current = threadId;
    requestAnimationFrame(() => {
      const cur = scrollRef.current;
      if (!cur) return;
      const maxScroll = cur.scrollHeight - cur.clientHeight;
      if (initialScrollFraction == null) {
        cur.scrollTop = maxScroll;
        lastSetTopRef.current = maxScroll;
        modeRef.current = "tail";
      } else {
        const top = initialScrollFraction * maxScroll;
        cur.scrollTop = top;
        lastSetTopRef.current = top;
        const distance = maxScroll - top;
        modeRef.current =
          distance < NEAR_BOTTOM_PX ? "tail" : "manual";
      }
    });
  }, [threadId, messages.length, initialScrollFraction, isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      modeRef.current = "tail";
    }
  }, [isStreaming]);

  useLayoutEffect(() => {
    if (modeRef.current !== "tail") return;
    if (!scrollRef.current) return;
    if (isStreaming) {
      animateToBottom();
    } else {
      snapToBottom();
    }
  }, [messages, isStreaming, threadId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (
      lastSetTopRef.current >= 0 &&
      Math.abs(el.scrollTop - lastSetTopRef.current) < 1.5
    ) {
      return;
    }
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const distance = maxScroll - el.scrollTop;

    if (
      modeRef.current === "tail" &&
      distance > FAR_FROM_BOTTOM_PX
    ) {
      modeRef.current = "manual";
    } else if (
      modeRef.current === "manual" &&
      distance < NEAR_BOTTOM_PX
    ) {
      modeRef.current = "tail";
    }

    if (restoredThreadRef.current !== threadId) return;

    const fraction = el.scrollTop / maxScroll;
    const next = fraction > 0.97 ? null : fraction;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      if (lastSavedRef.current === next) return;
      lastSavedRef.current = next;
      onScrollChange(next);
    }, 400);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
      style={{
        backgroundColor: "var(--bg)",
        overflowAnchor: "none",
      }}
    >
      {messages.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            marginTop: "6rem",
            fontSize: "0.95rem",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              marginBottom: "0.5rem",
            }}
          >
            Start a conversation
          </div>
          <div style={{ opacity: 0.6 }}>
            Type a message below to begin
          </div>
        </div>
      )}
      {messages.map((msg, i) => {
        const isLatestAssistant =
          msg.role === "assistant" &&
          !messages.slice(i + 1).some(
            (m) => m.role === "assistant",
          );
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            selectedNodeId={
              isLatestAssistant ? selectedNodeId : null
            }
            onSelectNode={onSelectNode}
            nodeLabels={nodeLabels}
          />
        );
      })}
      <div aria-hidden style={{ height: 1 }} />
    </div>
  );
}
