// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  useStoreApi,
  Panel,
  Background,
  BackgroundVariant,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import {
  Lock,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
  Unlock,
} from "lucide-react";
import "@xyflow/react/dist/style.css";

import { NodePalette } from "./NodePalette";
import { FlowToolbar } from "./FlowToolbar";
import { UserPromptNode } from "./nodes/UserPromptNode";
import { SystemPromptNode } from "./nodes/SystemPromptNode";
import { WebSearchNode } from "./nodes/WebSearchNode";
import { LLMNode } from "./nodes/LLMNode";
import { MsgHistoryNode } from "./nodes/MsgHistoryNode";
import { UserOutputNode } from "./nodes/UserOutputNode";
import { QuestionNode } from "./nodes/QuestionNode";
import { SubflowNode } from "./nodes/SubflowNode";
import { FilesNode } from "./nodes/FilesNode";
import { CompactNode } from "./nodes/CompactNode";
import {
  DEFAULT_NODES,
  DEFAULT_EDGES,
  FIXED_TYPES,
  deserializeEdges,
  deserializeNodes,
  serializeFlow,
} from "./flowSchema";
import { useFlowGraph } from "./useFlowGraph";
import { useFlowAutosave } from "./useFlowAutosave";
import type { FlowDefinition } from "../../hooks/useFlows";
import { useFlowHistory } from "../../hooks/useFlowHistory";
import { copyShareLink } from "../../lib/share";
import { useEditorShortcuts } from "../../hooks/useEditorShortcuts";
import {
  loadFlowDraft,
  saveFlowDraft,
} from "../../hooks/useFlowDraft";
import type { FlowOption } from "../../lib/builtinFlows";

interface FlowEditorProps {
  models: Array<{ id: string; label: string }>;
  activeNodeId: string | null;
  completedNodes: Set<string>;
  errorNodeId: string | null;
  nodeOutputs?: Record<string, string>;
  skippedNodes?: Set<string>;
  deadEdges?: Set<string>;
  candidateIndices?: Record<string, number>;
  onClearFlowDebug?: () => void;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  initialDefinition?: FlowDefinition;
  onDefinitionChange?: (def: FlowDefinition) => void;
  activeFlowId: string;
  flowOptions: FlowOption[];
  readOnly?: boolean;
  toolbarSlot?: React.ReactNode;
  isPublished?: boolean;
  hasUnpublishedChanges?: boolean;
  duplicatePublishedFlowName?: string | null;
  description?: string | null;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDescriptionChange?: (next: string) => void;
  onSaved?: () => void;
  onSaveError?: (status: number, message: string) => void;
  onCopy?: (
    definition: FlowDefinition,
    sourceName: string,
  ) => Promise<{ id: string }>;
  isDefault?: boolean;
  onSetAsDefault?: () => void;
  onDelete?: () => void;
  visible?: boolean;
  onMoreNodes?: () => void;
  nodeToInsert?: { type: string; nonce: number } | null;
  onNodeInserted?: () => void;
}

const NODE_TYPES: NodeTypes = {
  user_prompt: UserPromptNode,
  system_prompt: SystemPromptNode,
  msg_history: MsgHistoryNode,
  web_search: WebSearchNode,
  llm: LLMNode,
  question: QuestionNode,
  subflow: SubflowNode,
  user_output: UserOutputNode,
  files: FilesNode,
  compact: CompactNode,
};

export function FlowEditor({
  models,
  activeNodeId,
  completedNodes,
  errorNodeId,
  nodeOutputs,
  skippedNodes,
  deadEdges,
  candidateIndices,
  onClearFlowDebug,
  selectedNodeId,
  onNodeSelect,
  initialDefinition,
  onDefinitionChange,
  activeFlowId,
  flowOptions,
  readOnly = false,
  toolbarSlot,
  isPublished,
  hasUnpublishedChanges,
  duplicatePublishedFlowName,
  description,
  onPublish,
  onUnpublish,
  onDescriptionChange,
  onSaved,
  onSaveError,
  onCopy,
  isDefault,
  onSetAsDefault,
  onDelete,
  visible = true,
  onMoreNodes,
  nodeToInsert,
  onNodeInserted,
}: FlowEditorProps) {
  const sourceDef = useMemo(() => {
    const draft = loadFlowDraft(activeFlowId);
    if (draft) return draft;
    if (initialDefinition) return initialDefinition;
    return null;
  }, [activeFlowId, initialDefinition]);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    sourceDef ? deserializeNodes(sourceDef) : DEFAULT_NODES,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    sourceDef ? deserializeEdges(sourceDef) : DEFAULT_EDGES,
  );

  const activeOption = flowOptions.find((f) => f.id === activeFlowId);
  const flowName = activeOption?.name ?? "Untitled";
  const activeEditable = activeOption?.editable ?? true;
  const isBuiltin = activeFlowId.startsWith("__");
  const savedFlowId = isBuiltin ? null : activeFlowId;

  const [hasChanges, setHasChanges] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState<{
    edgeId: string;
    source: string;
    x: number;
    y: number;
  } | null>(null);

  // Captured from ReactFlow's onInit so the parent can re-fit
  // the viewport when the active flow changes.
  const fitViewRef = useRef<((opts?: { duration?: number }) => void) | null>(
    null,
  );

  const markDirty = useCallback(() => setHasChanges(true), []);
  const {
    commit: commitHistory,
    reset: resetHistory,
    undo,
    redo,
  } = useFlowHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
    onDirtyChange: markDirty,
  });

  // Reload editor state only when switching flows. Reacting to
  // initialDefinition identity changes would wipe history on every
  // autosave roundtrip (refetch produces a new object reference).
  const loadedFlowIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialDefinition) return;
    if (loadedFlowIdRef.current === activeFlowId) return;
    loadedFlowIdRef.current = activeFlowId;
    const draft = loadFlowDraft(activeFlowId);
    const def = draft ?? initialDefinition;
    setNodes(deserializeNodes(def));
    setEdges(deserializeEdges(def));
    setHasChanges(draft !== null);
    resetHistory();
    // Refit the viewport on the next frame so it runs after
    // ReactFlow has measured the swapped-in nodes.
    requestAnimationFrame(() => fitViewRef.current?.({ duration: 250 }));
  }, [
    initialDefinition,
    activeFlowId,
    setNodes,
    setEdges,
    resetHistory,
  ]);

  // The editor is kept mounted but display:none while its tab is
  // closed, so ReactFlow measures a 0x0 viewport. When it reappears,
  // refit once the new size has been observed (two frames later).
  const wasVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          fitViewRef.current?.({ duration: 0 }),
        ),
      );
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  const onDataChange = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      commitHistory();
      onClearFlowDebug?.();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, ...newData } }
            : n,
        ),
      );
      setHasChanges(true);
    },
    [setNodes, commitHistory, onClearFlowDebug],
  );

  const subflowOptions = useMemo(
    () =>
      flowOptions
        .filter(
          (f) => !f.id.startsWith("__") && f.id !== activeFlowId,
        )
        .map((f) => ({ id: f.id, name: f.displayName })),
    [flowOptions, activeFlowId],
  );

  const enrichedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        data: {
          ...node.data,
          models,
          flowOptions: subflowOptions,
          onDataChange,
          isActive: node.id === activeNodeId,
          isCompleted: completedNodes.has(node.id),
          isError: node.id === errorNodeId,
          isSkipped: skippedNodes?.has(node.id) ?? false,
          candidateIndex: candidateIndices?.[node.id],
        },
      })),
    [
      nodes,
      models,
      subflowOptions,
      onDataChange,
      selectedNodeId,
      activeNodeId,
      completedNodes,
      errorNodeId,
      skippedNodes,
      candidateIndices,
    ],
  );

  const enrichedEdges = useMemo(
    () =>
      edges.map((edge) => styleEdge(edge, errorNodeId, deadEdges, skippedNodes)),
    [edges, errorNodeId, deadEdges, skippedNodes],
  );

  useEffect(() => {
    const def = serializeFlow(nodes, edges);
    onDefinitionChange?.(def);
    if (hasChanges && !readOnly && activeEditable) {
      saveFlowDraft(activeFlowId, def);
    }
  }, [
    nodes,
    edges,
    onDefinitionChange,
    hasChanges,
    activeFlowId,
    readOnly,
    activeEditable,
  ]);

  const getDefinition = useCallback(
    () => serializeFlow(nodes, edges),
    [nodes, edges],
  );

  const {
    rfInstance,
    wrapperRef: reactFlowWrapper,
    handleNodesChange,
    onNodeDragStart,
    onConnect,
    onDragOver,
    onDrop,
    handleAddNode,
    pasteNode,
  } = useFlowGraph({
    nodes,
    setNodes,
    setEdges,
    onNodesChange,
    commitHistory,
    onClearFlowDebug,
    setHasChanges,
  });

  const clipboardRef = useRef<{
    type: string;
    data: Record<string, unknown>;
  } | null>(null);

  const handleCopyNode = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node?.type || FIXED_TYPES.has(node.type)) return;
    clipboardRef.current = {
      type: node.type,
      data: { ...(node.data as Record<string, unknown>) },
    };
  }, [selectedNodeId, nodes]);

  const handlePasteNode = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || readOnly) return;
    pasteNode(clip.type, clip.data);
  }, [pasteNode, readOnly]);

  useEditorShortcuts({
    onUndo: undo,
    onRedo: redo,
    onCopy: handleCopyNode,
    onPaste: handlePasteNode,
  });

  const insertedNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!nodeToInsert || readOnly) return;
    if (insertedNonceRef.current === nodeToInsert.nonce) return;
    insertedNonceRef.current = nodeToInsert.nonce;
    handleAddNode(nodeToInsert.type);
    onNodeInserted?.();
  }, [nodeToInsert, readOnly, handleAddNode, onNodeInserted]);

  useFlowAutosave({
    savedFlowId,
    readOnly,
    activeFlowId,
    activeEditable,
    flowName,
    hasChanges,
    description,
    initialDefinition,
    setHasChanges,
    getDefinition,
    onAutoCopy: onCopy,
    onSaved,
    onSaveError,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--bg)",
      }}
    >
      {toolbarSlot ?? (
        <FlowToolbar
          flowName={flowName}
          isDefault={isDefault}
          onSetAsDefault={onSetAsDefault}
          onShare={
            savedFlowId
              ? () => copyShareLink(savedFlowId)
              : undefined
          }
          onCopy={
            onCopy
              ? () => {
                  onCopy(getDefinition(), flowName);
                }
              : undefined
          }
          isPublished={isPublished}
          hasUnpublishedChanges={hasUnpublishedChanges}
          duplicatePublishedFlowName={duplicatePublishedFlowName}
          description={description ?? ""}
          onPublish={
            onPublish && activeEditable ? onPublish : undefined
          }
          onUnpublish={
            onUnpublish && activeEditable ? onUnpublish : undefined
          }
          onDescriptionChange={
            onDescriptionChange && activeEditable
              ? (next) => {
                  onDescriptionChange(next);
                  setHasChanges(true);
                }
              : undefined
          }
          onDelete={onDelete && activeEditable ? onDelete : undefined}
        />
      )}

      {!readOnly && (
        <NodePalette onAddNode={handleAddNode} onMoreNodes={onMoreNodes} />
      )}

      <div
        ref={reactFlowWrapper}
        style={{ flex: 1, minHeight: 0, position: "relative" }}
      >
        <ReactFlow
          nodes={enrichedNodes}
          edges={enrichedEdges}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          onNodesChange={
            readOnly
              ? (changes) => {
                  const benign = changes.filter(
                    (c) => c.type !== "remove" && c.type !== "position",
                  );
                  if (benign.length) onNodesChange(benign);
                }
              : handleNodesChange
          }
          onEdgesChange={
            readOnly
              ? () => {}
              : (changes) => {
                  const isDirty = changes.some((c) => c.type === "remove");
                  if (isDirty) {
                    commitHistory();
                    onClearFlowDebug?.();
                  }
                  onEdgesChange(changes);
                  if (isDirty) setHasChanges(true);
                }
          }
          onConnect={readOnly ? undefined : onConnect}
          onNodeDragStart={readOnly ? undefined : onNodeDragStart}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          onNodeClick={(_, node) =>
            onNodeSelect?.(
              selectedNodeId === node.id ? null : node.id,
            )
          }
          onPaneClick={() => onNodeSelect?.(null)}
          onEdgeMouseEnter={(event, edge) => {
            if (!nodeOutputs?.[edge.source]) return;
            if (
              deadEdges?.has(edge.id) ||
              skippedNodes?.has(edge.source)
            ) {
              return;
            }
            const rect = reactFlowWrapper.current?.getBoundingClientRect();
            setHoveredEdge({
              edgeId: edge.id,
              source: edge.source,
              x: event.clientX - (rect?.left ?? 0),
              y: event.clientY - (rect?.top ?? 0),
            });
          }}
          onEdgeMouseMove={(event) => {
            if (!hoveredEdge) return;
            const rect = reactFlowWrapper.current?.getBoundingClientRect();
            setHoveredEdge((prev) =>
              prev
                ? {
                    ...prev,
                    x: event.clientX - (rect?.left ?? 0),
                    y: event.clientY - (rect?.top ?? 0),
                  }
                : null,
            );
          }}
          onEdgeMouseLeave={() => setHoveredEdge(null)}
          onInit={(instance: unknown) => {
            const typed = instance as {
              screenToFlowPosition: (pos: {
                x: number;
                y: number;
              }) => { x: number; y: number };
              fitView: (opts?: { duration?: number }) => void;
            };
            rfInstance.current = typed;
            fitViewRef.current = typed.fitView.bind(typed);
          }}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode={["Delete", "Backspace"]}
          style={{ backgroundColor: "var(--bg)" }}
          defaultEdgeOptions={{
            type: "default",
            style: {
              stroke: "var(--text-secondary)",
              strokeWidth: 1,
            },
            animated: false,
          }}
        >
          <Panel
            position="bottom-left"
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
            }}
          >
            <FlowControlButtons readOnly={readOnly} onUndo={undo} onRedo={redo} />
          </Panel>
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border)"
          />
        </ReactFlow>

        {hoveredEdge && nodeOutputs?.[hoveredEdge.source] && (
          <div
            style={{
              position: "absolute",
              left: hoveredEdge.x + 12,
              top: hoveredEdge.y + 12,
              maxWidth: "320px",
              maxHeight: "240px",
              overflow: "auto",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 8px",
              fontSize: "0.75em",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            {nodeOutputs[hoveredEdge.source]}
          </div>
        )}
      </div>
    </div>
  );
}

function styleEdge(
  edge: Edge,
  errorNodeId: string | null,
  deadEdges: Set<string> | undefined,
  skippedNodes: Set<string> | undefined,
): Edge {
  if (deadEdges?.has(edge.id) || skippedNodes?.has(edge.source)) {
    return {
      ...edge,
      style: {
        stroke: "var(--text-secondary)",
        strokeWidth: 1,
        opacity: 0.3,
      },
    };
  }
  if (errorNodeId && edge.target === errorNodeId) {
    return {
      ...edge,
      style: { stroke: "var(--accent-error)", strokeWidth: 2 },
    };
  }
  if (edge.sourceHandle === "yes") {
    return {
      ...edge,
      style: { stroke: "var(--accent-success)", strokeWidth: 1.5 },
    };
  }
  if (edge.sourceHandle === "no") {
    return {
      ...edge,
      style: { stroke: "var(--accent-error)", strokeWidth: 1.5 },
    };
  }
  return edge;
}

const CONTROL_ICON_SIZE = 14;
const CONTROL_ICON_STROKE = 1.75;

function ControlIconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hover ? "var(--bg-hover)" : "transparent",
        border: "none",
        color: hover ? "var(--text)" : "var(--text-secondary)",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function FlowControlButtons({
  readOnly,
  onUndo,
  onRedo,
}: {
  readOnly: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const storeApi = useStoreApi();
  const isInteractive = useStore(
    (s) => s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
  );
  const toggleInteractive = () => {
    const next = !isInteractive;
    storeApi.setState({
      nodesDraggable: next,
      nodesConnectable: next,
      elementsSelectable: next,
    });
  };
  return (
    <>
      <ControlIconButton onClick={() => zoomIn()} title="Zoom in">
        <Plus size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
      </ControlIconButton>
      <ControlIconButton onClick={() => zoomOut()} title="Zoom out">
        <Minus size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
      </ControlIconButton>
      <ControlIconButton onClick={() => fitView()} title="Fit view">
        <Maximize size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
      </ControlIconButton>
      <ControlIconButton
        onClick={toggleInteractive}
        title={isInteractive ? "Lock canvas" : "Unlock canvas"}
      >
        {isInteractive ? (
          <Unlock size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
        ) : (
          <Lock size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
        )}
      </ControlIconButton>
      {!readOnly && (
        <>
          <ControlIconButton onClick={onUndo} title="Undo">
            <Undo2 size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
          </ControlIconButton>
          <ControlIconButton onClick={onRedo} title="Redo">
            <Redo2 size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE} />
          </ControlIconButton>
        </>
      )}
    </>
  );
}
