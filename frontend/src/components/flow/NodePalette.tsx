// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { type DragEvent, useCallback } from "react";
import { Tooltip } from "../Tooltip";
import { NODE_DESCRIPTIONS } from "./nodes/nodeDescriptions";
import { nodeLabel } from "./nodes/nodeCatalog";
import { effectiveMenu, useNodeMenu } from "../../hooks/useNodeMenu";

interface NodePaletteProps {
  onAddNode: (nodeType: string) => void;
  onMoreNodes?: () => void;
}

const chipStyle: React.CSSProperties = {
  padding: "3px 10px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--bg-surface)",
  color: "var(--text)",
  fontSize: "0.75rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
  userSelect: "none",
  borderRadius: "var(--radius-full)",
};

// Tooltip renders an inline-block wrapper that is the flex item, so the
// no-shrink must live there to keep chips full-size and force scrolling.
const noShrink: React.CSSProperties = { flexShrink: 0 };

export function NodePalette({ onAddNode, onMoreNodes }: NodePaletteProps) {
  const { data: storedMenu } = useNodeMenu();
  const menu = effectiveMenu(storedMenu);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, nodeType: string) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setDragImage(event.currentTarget, 10, 10);
    },
    [],
  );

  return (
    <div
      style={{
        // Bottom padding is split with the scroll row below so the
        // scrollbar drops a few px under the pills without the bar
        // growing taller; flex-start keeps "+ More" level with chips.
        padding: "8px 10px 4px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        gap: "6px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "4px",
          overflowX: "auto",
          flex: "1 1 auto",
          minWidth: 0,
          paddingBottom: "8px",
          scrollbarWidth: "thin",
        }}
      >
        {menu.map((type) => (
          <Tooltip
            key={type}
            text={NODE_DESCRIPTIONS[type] ?? ""}
            wrapperStyle={noShrink}
          >
            <div
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              onClick={() => onAddNode(type)}
              style={chipStyle}
            >
              {nodeLabel(type)}
            </div>
          </Tooltip>
        ))}
      </div>
      {onMoreNodes && (
        <Tooltip text="Browse and manage node types" wrapperStyle={noShrink}>
          <div
            onClick={onMoreNodes}
            style={{
              ...chipStyle,
              color: "var(--text-secondary)",
              borderStyle: "dashed",
            }}
          >
            + More
          </div>
        </Tooltip>
      )}
    </div>
  );
}
