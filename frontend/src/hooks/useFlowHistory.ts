// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";

export interface FlowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface UseFlowHistoryArgs {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onDirtyChange: () => void;
  maxEntries?: number;
}

export interface FlowHistoryApi {
  commit: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
}

export function useFlowHistory({
  nodes,
  edges,
  setNodes,
  setEdges,
  onDirtyChange,
  maxEntries = 100,
}: UseFlowHistoryArgs): FlowHistoryApi {
  const historyRef = useRef<{
    past: FlowSnapshot[];
    future: FlowSnapshot[];
  }>({ past: [], future: [] });
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const snapshot = useCallback((): FlowSnapshot => ({
    nodes: nodesRef.current.map((n) => ({
      ...n, data: { ...n.data },
    })),
    edges: edgesRef.current.map((e) => ({ ...e })),
  }), []);

  const commit = useCallback(() => {
    historyRef.current.past.push(snapshot());
    if (historyRef.current.past.length > maxEntries) {
      historyRef.current.past.shift();
    }
    historyRef.current.future = [];
  }, [snapshot, maxEntries]);

  const reset = useCallback(() => {
    historyRef.current = { past: [], future: [] };
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(snapshot());
    setNodes(prev.nodes);
    setEdges(prev.edges);
    onDirtyChange();
  }, [snapshot, setNodes, setEdges, onDirtyChange]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(snapshot());
    setNodes(next.nodes);
    setEdges(next.edges);
    onDirtyChange();
  }, [snapshot, setNodes, setEdges, onDirtyChange]);

  return { commit, reset, undo, redo };
}
