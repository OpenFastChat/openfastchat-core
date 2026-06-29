// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamNDJSON } from "../lib/stream";
import { isWelcomeThread } from "../lib/welcomeThread";
import { showNotice } from "../lib/notice";
import { isNetworkError } from "../lib/apiFetch";
import { showLoginPrompt } from "../lib/loginPrompt";
import { captchaHeaders } from "../lib/captcha";

// The slice of the cached `["me"]` user the chat engine reads and
// updates over the flow-execute stream. Wrappers store a wider user
// object on this key; useChat only touches the guest-session fields,
// which are part of the core stream contract (the guest_llm_calls
// event), not billing.
interface MeGuestState {
  is_guest?: boolean;
  guest_limit_reached?: boolean;
  guest_llm_calls_used?: number;
}

export type ChatStatus =
  | "idle"
  | "submitting"
  | "streaming"
  | "done"
  | "error"
  | "stopped";

export interface ContextBlock {
  node_id: string;
  node_type: string;
  content: string;
}

export interface Candidate {
  node_id: string;
  node_type: string;
  content: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  context?: ContextBlock[];
  candidates?: Candidate[];
}

interface UseChatOptions {
  threadId: string;
  model: string;
  flowDefinition: unknown;
  onRateLimit?: () => void;
  onUpgradeNeeded?: () => void;
  onAbortEdit?: (content: string) => void;
  onThreadRenamed?: (title: string) => void;
}

interface FlowEdgeShape {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export function useChat(options: UseChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [errorNodeId, setErrorNodeId] =
    useState<string | null>(null);
  const [nodeOutputs, setNodeOutputs] =
    useState<Record<string, string>>({});
  const [skippedNodes, setSkippedNodes] =
    useState<Set<string>>(new Set());
  const [deadEdges, setDeadEdges] =
    useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const clearFlowDebug = useCallback(() => {
    setErrorNodeId(null);
    setNodeOutputs({});
    setSkippedNodes(new Set());
    setDeadEdges(new Set());
  }, []);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Load messages when threadId changes. Skip when a send
  // is already in flight (e.g. anonymous first-send creates
  // the thread mid-stream — wiping state would drop the
  // optimistic user message and the streamed reply).
  // When no thread is selected, show the public welcome
  // preview so visitors see the seeded welcome chat before
  // any auto-provisioning happens.
  useEffect(() => {
    if (inFlightRef.current) return;
    const url = isWelcomeThread(options.threadId)
      ? "/api/welcome"
      : `/api/threads/${options.threadId}/messages`;
    setMessages([]);
    setStatus("idle");
    fetch(url)
      .then((res) => {
        if (!res.ok) return [];
        return res.json() as Promise<Message[]>;
      })
      .then((msgs) => {
        if (msgs.length > 0) setMessages(msgs);
      })
      .catch(() => {});
  }, [options.threadId]);

  // Stop on Escape while submitting or streaming
  useEffect(() => {
    if (
      status !== "streaming" &&
      status !== "submitting"
    ) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") abortRef.current?.abort();
    };
    document.addEventListener("keydown", handler);
    return () =>
      document.removeEventListener("keydown", handler);
  }, [status]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (content: string) => {
      if (
        status === "streaming" ||
        status === "submitting"
      ) return;

      const cachedUser = queryClient.getQueryData<MeGuestState | null>(["me"]);
      if (cachedUser?.is_guest && cachedUser.guest_limit_reached) {
        showLoginPrompt("prompts");
        return;
      }

      const {
        model, flowDefinition,
        onRateLimit, onUpgradeNeeded,
      } = optionsRef.current;

      const startThreadId = optionsRef.current.threadId;
      let captcha: Record<string, string>;
      try {
        captcha = await captchaHeaders();
      } catch {
        return;
      }
      inFlightRef.current = true;

      const tempId = `temp-${Date.now()}`;
      const optimistic: Message = {
        id: tempId, role: "user", content,
      };

      setMessages((prev) => [...prev, optimistic]);
      setStatus("submitting");
      setErrorNodeId(null);
      setNodeOutputs({});
      setSkippedNodes(new Set());
      setDeadEdges(new Set());

      const controller = new AbortController();
      abortRef.current = controller;
      const assistantTempId =
        `assistant-temp-${Date.now()}`;

      try {
        // Inject current model into LLM nodes
        const def = JSON.parse(
          JSON.stringify(flowDefinition),
        ) as {
          nodes: {
            type: string;
            data: Record<string, unknown>;
          }[];
        };
        for (const node of def.nodes) {
          if (node.type === "llm") {
            node.data.model = model;
          }
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...captcha,
        };
        const res = await fetch("/api/flows/execute", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            content,
            definition: def,
            thread_id: isWelcomeThread(startThreadId)
              ? undefined
              : startThreadId,
          }),
        });

        if (res.status === 403) {
          const body = await res
            .json()
            .catch(() => ({ message: "Forbidden" }));
          showNotice({
            kind: "captcha_failed",
            message:
              body?.message ||
              "Captcha failed — please try again.",
            statusCode: 403,
            httpMethod: "POST",
            httpPath: "/api/flows/execute",
            canReport: false,
          });
          setMessages((prev) =>
            prev.filter((m) => m.id !== tempId),
          );
          setStatus("idle");
          return;
        }

        if (res.status === 402) {
          setMessages((prev) =>
            prev.filter((m) => m.id !== tempId),
          );
          setStatus("idle");
          onUpgradeNeeded?.();
          return;
        }

        if (res.status === 429 || res.status === 503) {
          const body = await res
            .json()
            .catch(() => ({ message: "", error: "" }));
          setMessages((prev) =>
            prev.filter((m) => m.id !== tempId),
          );
          setStatus("idle");
          if (
            body?.error === "guest_limit" ||
            body?.error === "guest_capacity"
          ) {
            showLoginPrompt("rate_limited");
            return;
          }
          if (res.status === 429) {
            showNotice({
              kind: "rate_limited",
              message:
                body?.message ||
                "Rate limited — please try again later.",
              statusCode: 429,
              httpMethod: "POST",
              httpPath: "/api/flows/execute",
              canReport: false,
            });
            onRateLimit?.();
          }
          return;
        }

        if (!res.ok) {
          throw new Error(await res.text());
        }

        setStatus("streaming");

        setMessages((prev) => [
          ...prev,
          {
            id: assistantTempId,
            role: "assistant",
            content: "",
          },
        ]);

        let assistantId = assistantTempId;

        for await (const msg of streamNDJSON(res)) {
          if (msg.type === "user_saved") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? { ...m, id: msg.message_id }
                  : m,
              ),
            );
          } else if (msg.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content + msg.delta,
                    }
                  : m,
              ),
            );
          } else if (msg.type === "done") {
            assistantId = msg.message_id;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      id: msg.message_id,
                      content:
                        msg.content ?? m.content,
                      status: msg.truncated
                        ? "truncated"
                        : "complete",
                      candidates: msg.candidates,
                    }
                  : m,
              ),
            );
          } else if (msg.type === "flow_finished") {
            setStatus("done");
          } else if (msg.type === "node_done") {
            if (msg.node_id && msg.output !== undefined) {
              setNodeOutputs((prev) => ({
                ...prev,
                [msg.node_id]: msg.output,
              }));
            }
            if (!msg.show_output) continue;
            const blockContent = msg.output;
            if (!blockContent) continue;
            const ctx: ContextBlock = {
              node_id: msg.node_id,
              node_type: msg.node_type,
              content: blockContent,
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      context: [
                        ...(m.context ?? []),
                        ctx,
                      ],
                    }
                  : m,
              ),
            );
          } else if (msg.type === "node_skipped") {
            setSkippedNodes((prev) => {
              const next = new Set(prev);
              next.add(msg.node_id);
              return next;
            });
          } else if (msg.type === "branch") {
            const flowDef = optionsRef.current
              .flowDefinition as
              | { edges: FlowEdgeShape[] }
              | undefined;
            const winning = msg.branch;
            const losingIds: string[] =
              flowDef?.edges
                ?.filter(
                  (e) =>
                    e.source === msg.node_id &&
                    e.sourceHandle &&
                    e.sourceHandle !== winning,
                )
                .map((e) => e.id) ?? [];
            if (losingIds.length > 0) {
              setDeadEdges((prev) => {
                const next = new Set(prev);
                for (const id of losingIds) next.add(id);
                return next;
              });
            }
          } else if (msg.type === "guest_llm_calls") {
            queryClient.setQueryData<MeGuestState | null>(["me"], (prev) =>
              prev
                ? {
                    ...prev,
                    guest_llm_calls_used: msg.guest_llm_calls_used,
                    guest_limit_reached:
                      msg.guest_limit_reached ?? prev.guest_limit_reached,
                  }
                : prev,
            );
          } else if (msg.type === "thread_renamed") {
            if (msg.title) {
              optionsRef.current.onThreadRenamed?.(msg.title);
            }
          } else if (msg.type === "rate_limit") {
            setMessages((prev) =>
              prev.filter(
                (m) =>
                  m.id !== assistantTempId &&
                  m.id !== tempId,
              ),
            );
            setStatus("idle");
            onRateLimit?.();
            return;
          } else if (msg.type === "error") {
            showNotice({
              kind: "flow_execute_failed",
              message: msg.message,
              httpMethod: "POST",
              httpPath: "/api/flows/execute",
              context: msg.node_id
                ? { node_id: msg.node_id }
                : undefined,
              canReport: !msg.user_error,
            });
            if (msg.node_id) {
              setErrorNodeId(msg.node_id);
            }
            setStatus("error");
          }
        }

        setStatus((prev) =>
          prev === "submitting" || prev === "streaming"
            ? "done"
            : prev,
        );

        void queryClient.invalidateQueries({
          queryKey: ["me"],
        });

      } catch (err) {
        if (
          err instanceof Error &&
          err.name === "AbortError"
        ) {
          setMessages((prev) =>
            prev.filter((m) =>
              m.id !== assistantTempId &&
              m.id !== tempId,
            ),
          );
          setStatus("idle");
          optionsRef.current.onAbortEdit?.(content);
        } else {
          const isNetwork = isNetworkError(err);
          const msg = isNetwork
            ? "Couldn't reach the server — check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Unknown error";
          showNotice({
            kind: "flow_execute_failed",
            message: msg,
            httpMethod: "POST",
            httpPath: "/api/flows/execute",
            canReport: !isNetwork,
          });
          setStatus("error");
          setMessages((prev) =>
            prev.filter((m) => m.id !== tempId),
          );
        }
      } finally {
        inFlightRef.current = false;
        // If the active thread changed while we were
        // sending (anonymous-first-send case: the backend
        // routed our message into the welcome thread that
        // the parent only learned about after auto-provision),
        // pull the canonical message list so seeded welcome
        // messages appear alongside the streamed exchange.
        const endThreadId = optionsRef.current.threadId;
        if (
          endThreadId &&
          endThreadId !== startThreadId &&
          !isWelcomeThread(endThreadId)
        ) {
          try {
            const res = await fetch(
              `/api/threads/${endThreadId}/messages`,
            );
            if (res.ok) {
              const msgs =
                (await res.json()) as Message[];
              if (msgs.length > 0) setMessages(msgs);
            }
          } catch {
            // ignore
          }
        }
      }
    },
    [status],
  );

  return {
    messages, setMessages, status,
    errorNodeId, nodeOutputs, skippedNodes, deadEdges,
    clearFlowDebug,
    send, stop,
  };
}
