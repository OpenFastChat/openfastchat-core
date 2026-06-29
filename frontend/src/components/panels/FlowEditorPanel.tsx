// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { FlowEditor } from "../flow/FlowEditor";
import { MarketplaceBanner } from "../marketplace/MarketplaceBanner";
import {
  EMPTY_FLOW_DEFINITION,
  type FlowOption,
} from "../../lib/builtinFlows";
import type { ActiveFlow } from "../../lib/activeFlow";
import type { ModelInfo } from "../../hooks/useModels";
import type { FlowDefinition, FlowInfo } from "../../hooks/useFlows";

export interface FlowDebugState {
  errorNodeId: string | null;
  nodeOutputs: Record<string, string>;
  skippedNodes: Set<string>;
  deadEdges: Set<string>;
  candidateIndices: Record<string, number>;
  clearFlowDebug: () => void;
}

interface MarketplaceSingleState {
  name?: string;
  definition?: FlowDefinition;
}

interface FlowEditorPanelProps {
  activeFlow: ActiveFlow | null;
  userFlow: FlowOption;
  userFlowId: string;
  flowOptions: FlowOption[];
  models: ModelInfo[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  debug: FlowDebugState;
  isNarrow: boolean;
  // marketplace_single
  marketplaceSingle?: MarketplaceSingleState | null;
  // marketplace_multi
  multiWrapperDef?: FlowDefinition | null;
  // user-flow editing
  activeUserFlowRecord: FlowInfo | null;
  currentIsPublished: boolean;
  currentHasUnpublishedChanges: boolean;
  currentDuplicatePublishedFlowName: string | null;
  currentDescription: string;
  isTemplate: boolean;
  defaultFlowId: string | null;
  onPublish: () => void;
  onUnpublish: () => void;
  onDescriptionChange: (next: string) => void;
  onSetAsDefault?: () => void;
  onDeleteFlow?: () => void;
  onDefinitionChange: (def: FlowDefinition) => void;
  onSaved: () => void;
  onSaveError: (status: number, message: string) => void;
  onCopyFlow: (
    def: FlowDefinition,
    sourceName: string,
  ) => Promise<{ id: string }>;
  onActivateUserFlow: (id: string) => void;
  editRevertNonce?: number;
  visible: boolean;
  onMoreNodes?: () => void;
  nodeToInsert?: { type: string; nonce: number } | null;
  onNodeInserted?: () => void;
}

export function FlowEditorPanel(props: FlowEditorPanelProps) {
  const { activeFlow, isNarrow, visible } = props;

  return (
    <div
      style={{
        flex: isNarrow ? "1 1 100%" : "1 1 50%",
        minWidth: 0,
        display: visible ? "flex" : "none",
        flexDirection: "column",
        order: 1,
      }}
    >
      {activeFlow?.kind === "marketplace_single" ? (
        <MarketplaceSingleEditor {...props} activeId={activeFlow.id} />
      ) : activeFlow?.kind === "marketplace_multi" ? (
        <MarketplaceMultiEditor {...props} activeIds={activeFlow.ids} />
      ) : (
        <UserFlowEditor {...props} />
      )}
    </div>
  );
}

function MarketplaceSingleEditor({
  activeId,
  models,
  selectedNodeId,
  onSelectNode,
  debug,
  marketplaceSingle,
  flowOptions,
  onCopyFlow,
  onSaved,
  onSaveError,
  editRevertNonce,
  visible,
}: FlowEditorPanelProps & { activeId: string }) {
  return (
    <FlowEditor
      key={`mkt-single-${activeId}-${editRevertNonce ?? 0}`}
      visible={visible}
      models={models}
      activeNodeId={null}
      completedNodes={new Set<string>()}
      errorNodeId={debug.errorNodeId}
      nodeOutputs={debug.nodeOutputs}
      skippedNodes={debug.skippedNodes}
      deadEdges={debug.deadEdges}
      candidateIndices={debug.candidateIndices}
      onClearFlowDebug={debug.clearFlowDebug}
      selectedNodeId={selectedNodeId}
      onNodeSelect={onSelectNode}
      initialDefinition={
        marketplaceSingle?.definition ?? EMPTY_FLOW_DEFINITION
      }
      activeFlowId={activeId}
      flowOptions={flowOptions}
      onCopy={onCopyFlow}
      onSaved={onSaved}
      onSaveError={onSaveError}
    />
  );
}

function MarketplaceMultiEditor({
  activeIds,
  models,
  selectedNodeId,
  onSelectNode,
  debug,
  multiWrapperDef,
  flowOptions,
  onActivateUserFlow,
  visible,
}: FlowEditorPanelProps & { activeIds: string[] }) {
  return (
    <FlowEditor
      key={`mkt-multi-${activeIds.join(",")}`}
      visible={visible}
      models={models}
      activeNodeId={null}
      completedNodes={new Set<string>()}
      errorNodeId={debug.errorNodeId}
      nodeOutputs={debug.nodeOutputs}
      skippedNodes={debug.skippedNodes}
      deadEdges={debug.deadEdges}
      candidateIndices={debug.candidateIndices}
      onClearFlowDebug={debug.clearFlowDebug}
      selectedNodeId={selectedNodeId}
      onNodeSelect={onSelectNode}
      initialDefinition={multiWrapperDef ?? EMPTY_FLOW_DEFINITION}
      activeFlowId="__mkt-multi"
      flowOptions={flowOptions}
      readOnly
      toolbarSlot={
        <MarketplaceBanner
          label={`Comparing ${activeIds.length} flows`}
          actions={[
            {
              label: "Stop comparison",
              onClick: () => {
                if (flowOptions[0]) {
                  onActivateUserFlow(flowOptions[0].id);
                }
              },
            },
          ]}
        />
      }
    />
  );
}

function UserFlowEditor({
  userFlow,
  userFlowId,
  models,
  selectedNodeId,
  onSelectNode,
  debug,
  activeUserFlowRecord,
  currentIsPublished,
  currentHasUnpublishedChanges,
  currentDuplicatePublishedFlowName,
  currentDescription,
  isTemplate,
  defaultFlowId,
  onPublish,
  onUnpublish,
  onDescriptionChange,
  onSetAsDefault,
  onDeleteFlow,
  onDefinitionChange,
  onSaved,
  onSaveError,
  onCopyFlow,
  flowOptions,
  editRevertNonce,
  visible,
  onMoreNodes,
  nodeToInsert,
  onNodeInserted,
}: FlowEditorPanelProps) {
  return (
    <FlowEditor
      key={`user-${userFlowId}-${editRevertNonce ?? 0}`}
      onMoreNodes={onMoreNodes}
      nodeToInsert={nodeToInsert}
      onNodeInserted={onNodeInserted}
      visible={visible}
      models={models}
      activeNodeId={null}
      completedNodes={new Set<string>()}
      errorNodeId={debug.errorNodeId}
      nodeOutputs={debug.nodeOutputs}
      skippedNodes={debug.skippedNodes}
      deadEdges={debug.deadEdges}
      candidateIndices={debug.candidateIndices}
      onClearFlowDebug={debug.clearFlowDebug}
      selectedNodeId={selectedNodeId}
      onNodeSelect={onSelectNode}
      initialDefinition={userFlow.definition}
      onDefinitionChange={onDefinitionChange}
      activeFlowId={userFlowId}
      flowOptions={flowOptions}
      isPublished={currentIsPublished}
      hasUnpublishedChanges={currentHasUnpublishedChanges}
      duplicatePublishedFlowName={currentDuplicatePublishedFlowName}
      description={currentDescription}
      onPublish={onPublish}
      onUnpublish={onUnpublish}
      onDescriptionChange={onDescriptionChange}
      onCopy={onCopyFlow}
      isDefault={
        !!activeUserFlowRecord &&
        !!defaultFlowId &&
        activeUserFlowRecord.id === defaultFlowId
      }
      onSetAsDefault={
        activeUserFlowRecord ? onSetAsDefault : undefined
      }
      onDelete={
        isTemplate && activeUserFlowRecord ? onDeleteFlow : undefined
      }
      onSaved={onSaved}
      onSaveError={onSaveError}
    />
  );
}
