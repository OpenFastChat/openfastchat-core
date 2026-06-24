// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Handle, Position } from "@xyflow/react";
import { NODE_DESCRIPTIONS } from "./nodeDescriptions";

export interface OutputHandleSpec {
  id: string;
  color?: string;
  style?: CSSProperties;
  label?: string;
  labelColor?: string;
}

interface BaseNodeProps {
  label: string;
  icon: string;
  nodeType?: string;
  children?: ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
  outputHandles?: OutputHandleSpec[];
  selected?: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
  isError?: boolean;
  isSkipped?: boolean;
  candidateIndex?: number;
  showOutput?: boolean;
  onToggleShowOutput?: () => void;
  minWidth?: number | string;
  maxWidth?: number | string;
}

export function BaseNode({
  label,
  icon,
  nodeType,
  children,
  hasInput = false,
  hasOutput = false,
  outputHandles,
  selected = false,
  isActive = false,
  isCompleted = false,
  isError = false,
  isSkipped = false,
  candidateIndex,
  showOutput,
  onToggleShowOutput,
  minWidth = "160px",
  maxWidth = "220px",
}: BaseNodeProps) {
  const description = nodeType
    ? NODE_DESCRIPTIONS[nodeType]
    : undefined;

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipTimer = useRef<number | null>(null);
  const showTooltip = () => {
    if (!description) return;
    if (tooltipTimer.current) {
      window.clearTimeout(tooltipTimer.current);
    }
    tooltipTimer.current = window.setTimeout(
      () => setTooltipOpen(true),
      500,
    );
  };
  const hideTooltip = () => {
    if (tooltipTimer.current) {
      window.clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltipOpen(false);
  };
  useEffect(
    () => () => {
      if (tooltipTimer.current) {
        window.clearTimeout(tooltipTimer.current);
      }
    },
    [],
  );
  let borderColor = "var(--border)";
  if (selected) borderColor = "var(--accent)";
  if (isActive) borderColor = "var(--accent)";
  if (isCompleted) borderColor = "var(--accent-success)";
  if (isError) borderColor = "var(--accent-error)";
  if (isSkipped) borderColor = "var(--border)";

  return (
    <div
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      style={{
        backgroundColor: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-md)",
        fontSize: "0.8rem",
        minWidth,
        maxWidth,
        position: "relative",
        opacity: isSkipped ? 0.35 : 1,
        boxShadow: isActive || selected
          ? `0 0 8px rgba(108,138,255,0.2)`
          : "none",
      }}
    >
      {tooltipOpen && description && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--bg-input)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "6px 10px",
            fontSize: "0.7rem",
            lineHeight: 1.4,
            maxWidth: 220,
            width: "max-content",
            whiteSpace: "normal",
            boxShadow:
              "0 4px 16px rgba(0, 0, 0, 0.35)",
            zIndex: 1000,
            pointerEvents: "none",
            animation:
              "tooltipFadeIn 100ms ease-out forwards",
          }}
        >
          {description}
        </div>
      )}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            width: 8,
            height: 8,
          }}
        />
      )}

      <div
        style={{
          padding: "6px 10px",
          borderBottom: children
            ? `1px solid ${borderColor}`
            : undefined,
          color: "var(--accent-text)",
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          borderRadius: children
            ? "var(--radius-md) var(--radius-md) 0 0"
            : "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          {icon} {label}
          {isCompleted && (
            <span
              style={{
                color: "var(--accent-success)",
                marginLeft: "4px",
              }}
            >
              ok
            </span>
          )}
          {candidateIndex !== undefined && (
            <span
              title="Candidate tab index in chat reply"
              style={{
                marginLeft: "6px",
                padding: "0 5px",
                fontSize: "0.75em",
                color: "var(--text)",
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {candidateIndex + 1}
            </span>
          )}
        </span>
        {onToggleShowOutput !== undefined && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleShowOutput();
            }}
            title={
              showOutput
                ? "Hide output in chat"
                : "Show output in chat"
            }
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: showOutput
                ? "var(--text)"
                : "var(--text-secondary)",
              opacity: showOutput ? 0.8 : 0.3,
              fontSize: "0.75em",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            {showOutput ? "\u25C9" : "\u25CE"}
          </button>
        )}
      </div>

      {children && (
        <div
          style={{
            padding: "6px 10px",
            color: "var(--text-secondary)",
          }}
        >
          {children}
        </div>
      )}

      {hasOutput && !outputHandles && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            width: 8,
            height: 8,
          }}
        />
      )}

      {outputHandles?.map((h) => (
        <span key={h.id}>
          <Handle
            id={h.id}
            type="source"
            position={Position.Right}
            style={{
              background: h.color ?? "var(--accent)",
              border: "1px solid var(--border)",
              width: 8,
              height: 8,
              ...h.style,
            }}
          />
          {h.label && (
            <span
              style={{
                position: "absolute",
                right: 14,
                top: h.style?.top,
                bottom: h.style?.bottom,
                transform: "translateY(-50%)",
                fontSize: "0.7em",
                fontWeight: 600,
                color:
                  h.labelColor ??
                  h.color ??
                  "var(--text-secondary)",
                pointerEvents: "none",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {h.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
