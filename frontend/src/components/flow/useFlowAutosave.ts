// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef } from "react";
import { useUpdateFlow, type FlowDefinition } from "../../hooks/useFlows";
import { clearFlowDraft } from "../../hooks/useFlowDraft";
import { structuralFlowKey } from "./flowSchema";

interface AutosaveDeps {
  savedFlowId: string | null;
  readOnly: boolean;
  activeFlowId: string;
  activeEditable: boolean;
  flowName: string;
  hasChanges: boolean;
  description?: string | null;
  initialDefinition?: FlowDefinition;
  setHasChanges: (value: boolean) => void;
  getDefinition: () => FlowDefinition;
  onAutoCopy?: (
    definition: FlowDefinition,
    sourceName: string,
  ) => Promise<{ id: string }>;
  onSaved?: () => void;
  onSaveError?: (status: number, message: string) => void;
}

export function useFlowAutosave(deps: AutosaveDeps) {
  const updateFlow = useUpdateFlow();
  const savedSnapshotRef = useRef<string>("");
  const savingRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deps.hasChanges) return;
    const def = deps.initialDefinition ?? { nodes: [], edges: [] };
    savedSnapshotRef.current = JSON.stringify({
      def,
      description: deps.description ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.initialDefinition, deps.description]);

  const autoSave = useCallback(async () => {
    if (!deps.savedFlowId || deps.readOnly) return;
    if (savingRef.current) return;
    const def = deps.getDefinition();
    const snapshot = JSON.stringify({
      def,
      description: deps.description ?? "",
    });
    if (snapshot === savedSnapshotRef.current) {
      deps.setHasChanges(false);
      return;
    }
    savingRef.current = true;
    try {
      if (!deps.activeEditable && deps.onAutoCopy) {
        const initialStruct = structuralFlowKey(
          deps.initialDefinition ?? { nodes: [], edges: [] },
        );
        if (structuralFlowKey(def) === initialStruct) {
          savedSnapshotRef.current = snapshot;
          deps.setHasChanges(false);
          return;
        }
        await deps.onAutoCopy(def, deps.flowName);
        savedSnapshotRef.current = snapshot;
        deps.setHasChanges(false);
        clearFlowDraft(deps.activeFlowId);
        deps.onSaved?.();
        return;
      }
      await updateFlow.mutateAsync({
        id: deps.savedFlowId,
        name: deps.flowName,
        definition: def,
        description: deps.description ?? null,
      });
      savedSnapshotRef.current = snapshot;
      deps.setHasChanges(false);
      clearFlowDraft(deps.activeFlowId);
      deps.onSaved?.();
    } catch (e) {
      const err = e as { status?: number; message?: string };
      deps.onSaveError?.(err.status ?? 0, err.message ?? "Save failed");
    } finally {
      savingRef.current = false;
    }
  }, [deps, updateFlow]);

  useEffect(() => {
    if (!deps.hasChanges || deps.readOnly || !deps.savedFlowId) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(autoSave, 600);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [deps.hasChanges, deps.readOnly, deps.savedFlowId, autoSave]);
}
