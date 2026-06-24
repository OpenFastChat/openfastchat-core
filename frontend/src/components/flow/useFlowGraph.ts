// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useRef } from "react";
import {
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  FIXED_TYPES,
  defaultNodeData,
  newNodeId,
} from "./flowSchema";

interface FlowGraphDeps {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: (changes: NodeChange[]) => void;
  commitHistory: () => void;
  onClearFlowDebug?: () => void;
  setHasChanges: (value: boolean) => void;
}

interface RfInstance {
  screenToFlowPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
}

export function useFlowGraph(deps: FlowGraphDeps) {
  const rfInstance = useRef<RfInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fixedNodeIds = useMemo(
    () =>
      new Set(
        deps.nodes
          .filter((n) => FIXED_TYPES.has(n.type ?? ""))
          .map((n) => n.id),
      ),
    [deps.nodes],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter(
        (c) => c.type !== "remove" || !fixedNodeIds.has(c.id),
      );
      if (filtered.length === 0) return;
      const isRemove = filtered.some((c) => c.type === "remove");
      const isDragEnd = filtered.some(
        (c) => c.type === "position" && c.dragging === false,
      );
      if (isRemove) {
        deps.commitHistory();
        deps.onClearFlowDebug?.();
      }
      deps.onNodesChange(filtered);
      if (isRemove || isDragEnd) deps.setHasChanges(true);
    },
    [deps, fixedNodeIds],
  );

  const onNodeDragStart = useCallback(() => {
    deps.commitHistory();
    deps.onClearFlowDebug?.();
  }, [deps]);

  const onConnect = useCallback(
    (connection: Connection) => {
      deps.commitHistory();
      deps.onClearFlowDebug?.();
      deps.setEdges((eds) => addEdge(connection, eds));
      deps.setHasChanges(true);
    },
    [deps],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const addNodeAt = useCallback(
    (
      nodeType: string,
      position: { x: number; y: number },
      data?: Record<string, unknown>,
    ) => {
      if (FIXED_TYPES.has(nodeType)) return;
      const newNode: Node = {
        id: newNodeId(nodeType),
        type: nodeType,
        position,
        data: data ?? defaultNodeData(nodeType),
      };
      deps.commitHistory();
      deps.onClearFlowDebug?.();
      deps.setNodes((nds) => [...nds, newNode]);
      deps.setHasChanges(true);
    },
    [deps],
  );

  const canvasCenter = useCallback(() => {
    if (rfInstance.current && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      return rfInstance.current.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    return { x: 300, y: 200 };
  }, []);

  const pasteNode = useCallback(
    (nodeType: string, data: Record<string, unknown>) => {
      const center = canvasCenter();
      addNodeAt(
        nodeType,
        { x: center.x + 30, y: center.y + 30 },
        { ...data },
      );
    },
    [addNodeAt, canvasCenter],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!rfInstance.current) return;
      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const nodeType = event.dataTransfer.getData("application/reactflow");
      if (!nodeType) return;
      addNodeAt(nodeType, position);
    },
    [addNodeAt],
  );

  const handleAddNode = useCallback(
    (nodeType: string) => {
      addNodeAt(nodeType, canvasCenter());
    },
    [addNodeAt, canvasCenter],
  );

  return {
    rfInstance,
    wrapperRef,
    handleNodesChange,
    onNodeDragStart,
    onConnect,
    onDragOver,
    onDrop,
    handleAddNode,
    pasteNode,
  };
}
