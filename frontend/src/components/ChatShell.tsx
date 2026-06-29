// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShellHeader } from "./ShellHeader";
import { Sidebar } from "./Sidebar";
import { ChatWindow } from "./ChatWindow";
import { InputBar } from "./InputBar";
import { StatusBar } from "./StatusBar";
import {
  subscribeLoginPrompt,
  type LoginPromptReason,
} from "../lib/loginPrompt";
import { NoticeModal } from "./NoticeModal";
import { FlowEditorPanel } from "./panels/FlowEditorPanel";
import { MarketplacePanel } from "./marketplace/MarketplacePanel";
import { NodesPanel } from "./nodes/NodesPanel";
import { useChat } from "../hooks/useChat";
import { WELCOME_THREAD_ID, isWelcomeThread } from "../lib/welcomeThread";
import { useIsMobile, useIsNarrow } from "../hooks/useIsMobile";
import {
  useModels,
  usePreferredModel,
  useSavePreferredModel,
} from "../hooks/useModels";
import {
  useDocuments,
  useUpload,
  useDeleteDocument,
} from "../hooks/useDocuments";
import {
  useThreads,
  useCreateThread,
  useDeleteThread,
  useRenameThread,
  useUpdateThreadScroll,
  type Thread,
} from "../hooks/useThreads";
import {
  useFlows,
  useCreateFlow,
  useUpdateFlow,
  useDeleteFlow,
  useActivateFlow,
  usePublishFlow,
  useUnpublishFlow,
  FlowApiError,
  type FlowDefinition,
} from "../hooks/useFlows";
import {
  useMarketplaceFlow,
  useMarketplaceFlows,
  type MarketplaceFlow,
} from "../hooks/useMarketplace";
import { useActiveFlow } from "../hooks/useActiveFlow";
import { usePanelState } from "../hooks/usePanelState";
import { apiFetch } from "../lib/apiFetch";
import { showNotice, subscribeNotice, type Notice } from "../lib/notice";
import { EMPTY_FLOW_DEFINITION, type FlowOption } from "../lib/builtinFlows";
import type { ActiveFlow } from "../lib/activeFlow";
import { buildComparisonDefinition } from "../lib/flowComparison";

/**
 * Minimal identity the shell orchestration needs. Wrappers map their
 * own (possibly billing-laden) user onto this; billing, balances, and
 * account UI live entirely in wrapper-supplied slots.
 */
export interface ShellUser {
  is_guest: boolean;
  is_anonymous: boolean;
  guest_limit_reached?: boolean;
  default_flow_id: string | null;
  is_template?: boolean;
}

export interface ChatShellProps {
  user: ShellUser | null;
  brand?: string;
  headerActions?: ReactNode;
  statusLinks?: { label: string; href: string }[];
  onContact?: () => void;
  statusEmail?: string;
  inputDisabled?: boolean;
  onUpgradeNeeded?: () => void;
  renderLoginPrompt?: (
    reason: LoginPromptReason,
    onClose: () => void,
  ) => ReactNode;
}

export function ChatShell({
  user,
  brand,
  headerActions,
  statusLinks,
  onContact,
  statusEmail,
  inputDisabled,
  onUpgradeNeeded,
  renderLoginPrompt,
}: ChatShellProps) {
  const isGuest = user?.is_guest ?? true;
  const isAnonymous = user?.is_anonymous ?? true;
  const isProvisioned = !isAnonymous;
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();
  const queryClient = useQueryClient();

  // ----- panel + login modal -----
  const { panel, setPanel, toggle, showFlowEditor, showMarketplace, showNodes } =
    usePanelState();
  // Pre-mount the flow editor in the background once the user exists
  // (logged in or guest) and keep it alive (toggling display) so even
  // the first open is instant instead of rebuilding ReactFlow. The
  // flowsQuery.isSuccess render gate defers the actual mount until
  // flows have loaded, well after the initial paint.
  const [flowEditorMounted, setFlowEditorMounted] = useState(false);
  useEffect(() => {
    if (showFlowEditor || user) setFlowEditorMounted(true);
  }, [showFlowEditor, user]);
  const [nodeToInsert, setNodeToInsert] = useState<{
    type: string;
    nonce: number;
  } | null>(null);
  const nodeInsertCounter = useRef(0);
  const handleUseNode = useCallback(
    (type: string) => {
      setFlowEditorMounted(true);
      nodeInsertCounter.current += 1;
      setNodeToInsert({ type, nonce: nodeInsertCounter.current });
      setPanel("flows");
    },
    [setPanel],
  );
  const [loginPrompt, setLoginPrompt] = useState<LoginPromptReason | null>(
    null,
  );
  const [editRevertNonce, setEditRevertNonce] = useState(0);
  const [notice, setErrorReport] =
    useState<Notice | null>(null);

  useEffect(() => {
    return subscribeNotice((err) => setErrorReport(err));
  }, []);

  useEffect(() => {
    return subscribeLoginPrompt((reason) => setLoginPrompt(reason));
  }, []);

  // A guest who has exhausted their free prompts is hard-blocked:
  // surface the (non-dismissable) sign-in prompt right away, including
  // after a reload, instead of waiting for the next failed send.
  useEffect(() => {
    if (user?.is_guest && user.guest_limit_reached) {
      setLoginPrompt("prompts");
    }
  }, [user?.is_guest, user?.guest_limit_reached]);

  // ----- models -----
  const modelsQuery = useModels();
  const models = modelsQuery.data ?? [];
  const preferredQuery = usePreferredModel({ enabled: isProvisioned });
  const saveModel = useSavePreferredModel();
  const [model, setModel] = useState("");

  useEffect(() => {
    if (models.length === 0 || model) return;
    const preferred = preferredQuery.data;
    if (preferred && models.some((m) => m.id === preferred)) {
      setModel(preferred);
    } else {
      const fallback = models.find(
        (m) => m.id === "llama-3.3-70b-versatile",
      );
      setModel(fallback?.id ?? models[0].id);
    }
  }, [models, model, preferredQuery.data]);

  // ----- threads -----
  const threadsQuery = useThreads({ enabled: isProvisioned });
  const threads = threadsQuery.data ?? [];
  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();
  const renameThread = useRenameThread();
  const updateThreadScroll = useUpdateThreadScroll();
  const [activeThreadId, setActiveThreadId] = useState(
    WELCOME_THREAD_ID,
  );
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);

  // Sidebar-visible thread list. When the user has no real
  // threads (anonymous visitor, or signed-in user who deleted
  // everything), inject a sentinel "Welcome" entry that maps
  // to the public /api/welcome preview.
  const sidebarThreads = useMemo<Thread[]>(() => {
    if (threads.length > 0) return threads;
    return [
      {
        id: WELCOME_THREAD_ID,
        title: "Welcome",
        updated_at: "",
        // Start at the top of the welcome content for new
        // visitors instead of the default scroll-to-bottom.
        scroll_top_fraction: 0,
      },
    ];
  }, [threads]);

  useEffect(() => {
    if (threads.length === 0) {
      if (activeThreadId !== WELCOME_THREAD_ID) {
        setActiveThreadId(WELCOME_THREAD_ID);
      }
      return;
    }
    if (
      activeThreadId === WELCOME_THREAD_ID ||
      !threads.some((t) => t.id === activeThreadId)
    ) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  // ----- flows -----
  const flowsQuery = useFlows();
  const flows = flowsQuery.data ?? [];
  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();
  const onRenameFlowError = (e: unknown) => {
    const err = e as FlowApiError;
    showNotice({
      kind: "flow_rename_failed",
      message: err.message || "Could not rename this flow.",
      statusCode: err.status,
      httpMethod: "PUT",
      httpPath: "/api/flows/:id",
      canReport: err.status !== 400,
    });
  };
  const deleteFlow = useDeleteFlow();
  const activateFlow = useActivateFlow();
  const publishFlow = usePublishFlow();
  const unpublishFlow = useUnpublishFlow();

  const {
    activeFlow,
    setActiveFlow,
    setActiveUserFlow,
    marketplaceSelection,
    setMarketplaceSelection,
    userFlowId,
    marketplaceSingleId,
    marketplaceMultiIds,
  } = useActiveFlow({
    flows,
    flowsReady: flowsQuery.isSuccess,
    defaultFlowId: user?.default_flow_id ?? null,
    onDeepLink: () => setPanel("flows"),
  });

  const marketplaceSingleQuery = useMarketplaceFlow(
    marketplaceSingleId,
  );

  const flowOptions: FlowOption[] = useMemo(() => {
    const base = flows.map((f) => ({
      id: f.id,
      name: f.name,
      displayName: f.display_name,
      editable: f.editable,
      definition: f.definition,
    }));
    const mkt = marketplaceSingleQuery.data;
    if (
      activeFlow?.kind === "marketplace_single" &&
      mkt &&
      !base.some((f) => f.id === mkt.id)
    ) {
      base.push({
        id: mkt.id,
        name: mkt.name,
        displayName: mkt.name,
        editable: false,
        definition: mkt.definition,
      });
    }
    return base;
  }, [flows, activeFlow, marketplaceSingleQuery.data]);

  const userFlow: FlowOption =
    flowOptions.find((f) => f.id === userFlowId) ??
    flowOptions[0] ?? {
      id: "",
      name: "Loading…",
      displayName: "Loading…",
      editable: false,
      definition: EMPTY_FLOW_DEFINITION,
    };

  const activeUserFlowRecord =
    activeFlow?.kind === "user"
      ? flows.find((f) => f.id === activeFlow.id) ?? null
      : null;

  const [editorDefinition, setEditorDefinition] =
    useState<FlowDefinition | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // metaDrafts holds pending description edits per flow.
  const [metaDrafts, setMetaDrafts] = useState<
    Record<string, { description?: string }>
  >({});
  const metaDraft = activeUserFlowRecord
    ? metaDrafts[activeUserFlowRecord.id] ?? {}
    : {};
  const currentIsPublished = activeUserFlowRecord?.is_published ?? false;
  const currentHasUnpublishedChanges =
    activeUserFlowRecord?.has_unpublished_changes ?? false;
  const currentDuplicatePublishedFlowName =
    activeUserFlowRecord?.duplicate_published_flow_name ?? null;
  const currentDescription = activeUserFlowRecord
    ? metaDraft.description ?? activeUserFlowRecord.description ?? ""
    : "";

  // ----- marketplace -----
  const marketplaceFlowsQuery = useMarketplaceFlows("top");
  const marketplaceNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of marketplaceFlowsQuery.data ?? []) {
      map[f.id] = f.name;
    }
    return map;
  }, [marketplaceFlowsQuery.data]);
  const multiWrapperDef = useMemo(
    () =>
      marketplaceMultiIds.length > 0
        ? buildComparisonDefinition(
            marketplaceMultiIds,
            marketplaceNameMap,
          )
        : null,
    [marketplaceMultiIds, marketplaceNameMap],
  );

  // ----- effective flow for execution -----
  const effectiveFlow: FlowDefinition = (() => {
    if (activeFlow?.kind === "marketplace_multi") {
      return multiWrapperDef ?? EMPTY_FLOW_DEFINITION;
    }
    if (activeFlow?.kind === "marketplace_single") {
      return (
        marketplaceSingleQuery.data?.definition ?? EMPTY_FLOW_DEFINITION
      );
    }
    return showFlowEditor
      ? editorDefinition ?? userFlow.definition
      : userFlow.definition;
  })();

  const nodeLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const n of effectiveFlow.nodes ?? []) {
      if (n.type === "question" || n.type === "yes_no") {
        const q = (n.data?.question as string | undefined)?.trim();
        if (q) map[n.id] = `"${q}"`;
      }
    }
    return map;
  }, [effectiveFlow]);

  // ----- chat -----
  const {
    messages,
    setMessages,
    status,
    errorNodeId,
    nodeOutputs,
    skippedNodes,
    deadEdges,
    clearFlowDebug,
    send,
    stop,
  } = useChat({
    threadId: activeThreadId,
    model,
    flowDefinition: effectiveFlow,
    onRateLimit: () => {},
    onUpgradeNeeded: () => {
      onUpgradeNeeded?.();
      if (isGuest) setLoginPrompt("prompts");
    },
    onAbortEdit: (content) => setEditDraft(content),
    onThreadRenamed: (title) => {
      queryClient.setQueryData<Thread[]>(["threads"], (prev) =>
        prev?.map((t) =>
          t.id === activeThreadId ? { ...t, title } : t,
        ),
      );
    },
  });

  const candidateIndices = useMemo(() => {
    const out: Record<string, number> = {};
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      if (!m.candidates || m.candidates.length < 2) continue;
      m.candidates.forEach((c, idx) => {
        out[c.node_id] = idx;
      });
      break;
    }
    return out;
  }, [messages]);

  useEffect(() => {
    if (status === "done") {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }, [status, queryClient]);

  // ----- documents -----
  const docsQuery = useDocuments({ enabled: isProvisioned });
  const documents = docsQuery.data ?? [];
  const uploadMutation = useUpload();
  const deleteMutation = useDeleteDocument();

  // ----- action handlers -----
  const refreshMeIfAnon = useCallback(() => {
    if (isAnonymous) {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  }, [isAnonymous, queryClient]);

  const handleNewChat = () => {
    if (isMobile) setPanel("none");
    createThread.mutate(undefined, {
      onSuccess: (t) => {
        setActiveThreadId(t.id);
        refreshMeIfAnon();
      },
    });
  };

  const handleDeleteFlow = (id: string) => {
    if (id.startsWith("__")) return;
    const flow = flowOptions.find((f) => f.id === id);
    if (!flow?.editable) return;
    deleteFlow.mutate(id, {
      onSuccess: () => {
        if (id === userFlowId) {
          const remaining = flowOptions.filter((f) => f.id !== id);
          setActiveUserFlow(remaining[0]?.id ?? "");
        }
      },
    });
  };

  const handleCopyFlow = useCallback(
    async (def: FlowDefinition, sourceName: string) => {
      const created = await createFlow.mutateAsync({
        name: sourceName,
        definition: def,
        description: null,
      });
      setActiveUserFlow(created.id);
      refreshMeIfAnon();
      return { id: created.id };
    },
    [createFlow, refreshMeIfAnon, setActiveUserFlow],
  );

  const handleNewFlow = () => {
    const activeId =
      activeFlow?.kind === "user" ||
      activeFlow?.kind === "marketplace_single"
        ? activeFlow.id
        : null;
    const sourceName = activeId
      ? flowOptions.find((f) => f.id === activeId)?.name ?? "Flow"
      : "Flow";
    void handleCopyFlow(effectiveFlow, sourceName);
  };

  const handleDeleteThread = (id: string) => {
    if (isWelcomeThread(id)) return;
    deleteThread.mutate(id, {
      onSuccess: () => {
        if (id === activeThreadId) {
          const remaining = threads.filter((t) => t.id !== id);
          setActiveThreadId(remaining[0]?.id ?? WELCOME_THREAD_ID);
        }
      },
    });
  };

  const clearChat = async () => {
    if (!activeThreadId || isWelcomeThread(activeThreadId)) return;
    try {
      await apiFetch(`/api/threads/${activeThreadId}/messages`, {
        method: "DELETE",
      });
      setMessages([]);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <ShellHeader
        brand={brand}
        sidebarOpen={sidebarOpen}
        narrow={isNarrow}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        showFlowEditor={showFlowEditor}
        onToggleFlowEditor={() => toggle("flows")}
        showMarketplace={showMarketplace}
        onToggleMarketplace={() => toggle("marketplace")}
        showNodes={showNodes}
        onToggleNodes={() => toggle("nodes")}
        panel={panel}
        onSelectPanel={setPanel}
        actions={headerActions}
      />

      {isGuest &&
        loginPrompt &&
        renderLoginPrompt?.(loginPrompt, () => {
          if (loginPrompt === "edit_flow") {
            setEditRevertNonce((n) => n + 1);
          }
          setLoginPrompt(null);
        })}

      {notice && (
        <NoticeModal
          error={notice}
          onClose={() => setErrorReport(null)}
        />
      )}

      <div className="flex flex-1" style={{ minHeight: 0 }}>
        {sidebarOpen && (
          <Sidebar
            threads={sidebarThreads}
            activeThreadId={activeThreadId}
            editingThreadId={editingThreadId}
            flowOptions={flowOptions}
            activeFlowId={userFlowId}
            editingFlowId={editingFlowId}
            mobile={isMobile}
            onSelectThread={(id) => {
              if (!isNarrow) {
                setActiveThreadId(id);
                return;
              }
              if (id === activeThreadId) {
                setPanel(panel === "none" ? "flows" : "none");
                return;
              }
              setActiveThreadId(id);
              setPanel("none");
            }}
            onNewChat={handleNewChat}
            onDeleteThread={handleDeleteThread}
            onRenameThread={(id, title) => {
              if (isWelcomeThread(id)) return;
              renameThread.mutate({ id, title });
            }}
            onEditingDone={() => setEditingThreadId(null)}
            onSelectFlow={(id) => {
              const alreadyActive =
                activeFlow?.kind === "user" && activeFlow.id === id;
              if (alreadyActive) {
                toggle("flows");
                return;
              }
              setActiveUserFlow(id);
              if (panel === "marketplace") setPanel("flows");
            }}
            onNewFlow={handleNewFlow}
            onDeleteFlow={handleDeleteFlow}
            onRenameFlow={(id, name) => {
              const flow = flowOptions.find((f) => f.id === id);
              if (!flow) return;
              updateFlow.mutate(
                { id, name, definition: flow.definition },
                { onError: onRenameFlowError },
              );
            }}
            onEditingFlowDone={() => setEditingFlowId(null)}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <div
          className="flex flex-col"
          style={{
            flex:
              showFlowEditor || showMarketplace || showNodes
                ? "1 1 50%"
                : "1 1 100%",
            minWidth: 0,
            borderLeft:
              !isNarrow && (showFlowEditor || showMarketplace || showNodes)
                ? "1px solid var(--border)"
                : "none",
            order: 2,
            display:
              isNarrow && (showFlowEditor || showMarketplace || showNodes)
                ? "none"
                : "flex",
          }}
        >
            <ChatWindow
              threadId={activeThreadId}
              messages={messages}
              status={status}
              initialScrollFraction={
                sidebarThreads.find(
                  (t) => t.id === activeThreadId,
                )?.scroll_top_fraction ?? null
              }
              onScrollChange={(fraction) => {
                if (isWelcomeThread(activeThreadId)) return;
                updateThreadScroll.mutate({
                  id: activeThreadId,
                  fraction,
                });
              }}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              nodeLabels={nodeLabels}
            />

            <InputBar
              status={status}
              disabled={inputDisabled ?? false}
              model={model}
              models={models}
              messages={messages}
              editDraft={editDraft}
              onEditDraftConsumed={() => setEditDraft("")}
              activeFlowId={userFlowId}
              flowOptions={flowOptions}
              onFlowChange={setActiveUserFlow}
              documents={documents}
              mobile={isMobile}
              draftKey={
                activeThreadId ? `thread:${activeThreadId}` : "guest"
              }
              onModelChange={(m) => {
                setModel(m);
                saveModel.mutate(m);
              }}
              onSend={(content) => {
                // Sending from the welcome sentinel means the
                // user hasn't been provisioned yet (or just lost
                // all their threads). Let the backend route the
                // message into the latest thread, and refresh
                // /api/me + ["threads"] so the now-real welcome
                // thread takes over the active slot.
                send(content);
                if (isWelcomeThread(activeThreadId)) {
                  refreshMeIfAnon();
                  void queryClient.invalidateQueries({
                    queryKey: ["threads"],
                  });
                }
              }}
              onStop={stop}
              onUpload={(file) => uploadMutation.mutate(file)}
              onDeleteDocument={(id) => deleteMutation.mutate(id)}
              onClearChat={clearChat}
              onNewChat={handleNewChat}
              onDeleteChat={() => handleDeleteThread(activeThreadId)}
              onRenameChat={(title) => {
                if (isWelcomeThread(activeThreadId)) return;
                if (title) {
                  renameThread.mutate({ id: activeThreadId, title });
                } else {
                  setEditingThreadId(activeThreadId);
                }
              }}
              onNewFlow={handleNewFlow}
              onDeleteFlow={() => {
                if (userFlowId) handleDeleteFlow(userFlowId);
              }}
              onRenameFlow={(name) => {
                if (!userFlowId) return;
                const flow = flowOptions.find((f) => f.id === userFlowId);
                if (!flow?.editable) return;
                if (name) {
                  updateFlow.mutate(
                    {
                      id: userFlowId,
                      name,
                      definition: flow.definition,
                    },
                    { onError: onRenameFlowError },
                  );
                } else {
                  setEditingFlowId(userFlowId);
                  setPanel("flows");
                  setSidebarOpen(true);
                }
              }}
              onToggleFlows={() => toggle("flows")}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
              onShowHelp={(msg) => setMessages((prev) => [...prev, msg])}
            />
          </div>

        {showMarketplace && (
          <MarketplaceSection
            selectedIds={marketplaceSelection}
            isNarrow={isNarrow}
            flowOptions={flowOptions}
            onToggleSelection={(id) =>
              setMarketplaceSelection((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id],
              )
            }
            onUseSingle={(id) => {
              const own = flowOptions.find((f) => f.id === id);
              if (own) {
                setActiveUserFlow(id);
                setMarketplaceSelection([]);
                setPanel("flows");
                return;
              }
              const next: ActiveFlow = {
                kind: "marketplace_single",
                id,
              };
              setActiveFlow(next);
              setMarketplaceSelection([]);
              setPanel("flows");
            }}
            onUseMulti={(ids) => {
              setActiveFlow({ kind: "marketplace_multi", ids });
              setPanel("flows");
            }}
            onCopyFlow={(flow) => {
              void handleCopyFlow(flow.definition, flow.name);
            }}
            onClearMulti={() => setMarketplaceSelection([])}
          />
        )}

        {showNodes && (
          <div
            style={{
              flex: isNarrow ? "1 1 100%" : "1 1 50%",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              order: 1,
            }}
          >
            <NodesPanel onUse={handleUseNode} />
          </div>
        )}

        {flowEditorMounted && flowsQuery.isSuccess && (
          <FlowEditorPanel
            activeFlow={activeFlow}
            userFlow={userFlow}
            userFlowId={userFlowId}
            flowOptions={flowOptions}
            models={models}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            isNarrow={isNarrow}
            visible={showFlowEditor}
            debug={{
              errorNodeId,
              nodeOutputs,
              skippedNodes,
              deadEdges,
              candidateIndices,
              clearFlowDebug,
            }}
            marketplaceSingle={marketplaceSingleQuery.data ?? null}
            multiWrapperDef={multiWrapperDef}
            activeUserFlowRecord={activeUserFlowRecord}
            currentIsPublished={currentIsPublished}
            currentHasUnpublishedChanges={currentHasUnpublishedChanges}
            currentDuplicatePublishedFlowName={
              currentDuplicatePublishedFlowName
            }
            currentDescription={currentDescription}
            isTemplate={Boolean(user?.is_template)}
            defaultFlowId={user?.default_flow_id ?? null}
            onPublish={async () => {
              if (!activeUserFlowRecord) return;
              const id = activeUserFlowRecord.id;
              const pendingDescription = metaDrafts[id]?.description;
              try {
                if (pendingDescription !== undefined) {
                  await updateFlow.mutateAsync({
                    id,
                    name: activeUserFlowRecord.name,
                    definition: activeUserFlowRecord.definition,
                    description: pendingDescription,
                  });
                  setMetaDrafts((prev) => {
                    const { [id]: _drop, ...rest } = prev;
                    return rest;
                  });
                }
                await publishFlow.mutateAsync(id);
              } catch (e) {
                const err = e as FlowApiError;
                if (err.status === 403 && isGuest) {
                  setLoginPrompt("publish");
                  return;
                }
                showNotice({
                  kind: "flow_publish_failed",
                  message:
                    err.message ||
                    (err.status === 409
                      ? "An identical flow is already published."
                      : err.status === 403
                        ? "Not allowed to publish"
                        : "Publish failed"),
                  statusCode: err.status,
                  httpMethod: "POST",
                  httpPath: `/api/flows/${id}/publish`,
                  canReport: false,
                  context: {
                    flow_id: id,
                    flow_name: activeUserFlowRecord.name,
                  },
                });
              }
            }}
            onUnpublish={() => {
              if (!activeUserFlowRecord) return;
              unpublishFlow.mutate(activeUserFlowRecord.id);
            }}
            onDescriptionChange={(next) => {
              if (!activeUserFlowRecord) return;
              setMetaDrafts((prev) => ({
                ...prev,
                [activeUserFlowRecord.id]: {
                  ...prev[activeUserFlowRecord.id],
                  description: next,
                },
              }));
            }}
            onSetAsDefault={
              activeUserFlowRecord
                ? () => activateFlow.mutate(activeUserFlowRecord.id)
                : undefined
            }
            onDeleteFlow={
              activeUserFlowRecord
                ? () => handleDeleteFlow(activeUserFlowRecord.id)
                : undefined
            }
            onDefinitionChange={setEditorDefinition}
            onSaved={() => {
              if (!activeUserFlowRecord) return;
              setMetaDrafts((prev) => {
                const { [activeUserFlowRecord.id]: _drop, ...rest } = prev;
                return rest;
              });
            }}
            onSaveError={(status, message) => {
              if (message === "login required") {
                return;
              }
              if (status === 403 && isGuest) {
                setLoginPrompt("publish");
                return;
              }
              showNotice({
                kind: "flow_save_failed",
                message:
                  message ||
                  (status === 409
                    ? "An identical flow is already published."
                    : status === 403
                      ? "Not allowed to publish"
                      : "Save failed"),
                statusCode: status,
                httpMethod: "PUT",
                httpPath: activeUserFlowRecord
                  ? `/api/flows/${activeUserFlowRecord.id}`
                  : "/api/flows",
                canReport: false,
                context: {
                  flow_id: activeUserFlowRecord?.id,
                  flow_name: activeUserFlowRecord?.name,
                },
              });
            }}
            onCopyFlow={handleCopyFlow}
            onActivateUserFlow={setActiveUserFlow}
            editRevertNonce={editRevertNonce}
            onMoreNodes={() => setPanel("nodes")}
            nodeToInsert={nodeToInsert}
            onNodeInserted={() => setNodeToInsert(null)}
          />
        )}
      </div>

      {!isMobile && (
        <StatusBar
          status={status}
          email={statusEmail ?? "guest"}
          links={statusLinks}
          onContact={onContact}
        />
      )}
    </div>
  );
}

interface MarketplaceSectionProps {
  selectedIds: string[];
  isNarrow: boolean;
  flowOptions: FlowOption[];
  onToggleSelection: (id: string) => void;
  onUseSingle: (id: string) => void;
  onUseMulti: (ids: string[]) => void;
  onCopyFlow: (flow: MarketplaceFlow) => void;
  onClearMulti: () => void;
}

function MarketplaceSection({
  selectedIds,
  isNarrow,
  onToggleSelection,
  onUseSingle,
  onUseMulti,
  onCopyFlow,
  onClearMulti,
}: MarketplaceSectionProps) {
  return (
    <div
      style={{
        flex: isNarrow ? "1 1 100%" : "1 1 50%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        order: 1,
      }}
    >
      <MarketplacePanel
        multiSelectIds={selectedIds}
        onToggleMultiSelect={onToggleSelection}
        onUseSingle={onUseSingle}
        onUseMulti={onUseMulti}
        onCopyFlow={onCopyFlow}
        onClearMulti={onClearMulti}
      />
    </div>
  );
}

