// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Menu } from "lucide-react";
import type { Panel } from "../hooks/usePanelState";
import { pill, activePillStyle, MenuButton } from "./shellMenu";

export interface ShellHeaderProps {
  brand?: string;
  sidebarOpen: boolean;
  narrow?: boolean;
  onToggleSidebar: () => void;
  showFlowEditor?: boolean;
  onToggleFlowEditor?: () => void;
  showMarketplace?: boolean;
  onToggleMarketplace?: () => void;
  showNodes?: boolean;
  onToggleNodes?: () => void;
  panel?: Panel;
  onSelectPanel?: (panel: Panel) => void;
  actions?: ReactNode;
}

/**
 * Shell chrome: sidebar toggle, brand wordmark, and the Flows / Nodes /
 * Marketplace view toggles (a single dropdown when narrow). The wrapper
 * supplies its own right-hand controls (account, balance, billing) via
 * the `actions` slot.
 */
export function ShellHeader({
  brand = "OpenFastChat",
  sidebarOpen,
  narrow,
  onToggleSidebar,
  showFlowEditor,
  onToggleFlowEditor,
  showMarketplace,
  onToggleMarketplace,
  showNodes,
  onToggleNodes,
  panel,
  onSelectPanel,
  actions,
}: ShellHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-4"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
        height: "56px",
      }}
    >
      <div className="flex items-center" style={{ gap: "0.75rem" }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            height: "28px",
          }}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <Menu size={22} strokeWidth={1.75} />
        </button>
        <span
          className="brand-wordmark"
          style={{
            color: "var(--accent-text)",
            fontWeight: 600,
            fontSize: "1.05rem",
          }}
        >
          {brand}
        </span>
        {narrow ? (
          onSelectPanel &&
          (onToggleFlowEditor || onToggleMarketplace) && (
            <ViewDropdown
              panel={panel ?? "none"}
              onSelect={onSelectPanel}
              hasFlows={!!onToggleFlowEditor}
              hasMarketplace={!!onToggleMarketplace}
              hasNodes={!!onToggleNodes}
            />
          )
        ) : (
          <>
            {onToggleFlowEditor && (
              <button
                onClick={onToggleFlowEditor}
                style={activePillStyle(!!showFlowEditor)}
              >
                Flows
              </button>
            )}
            {onToggleNodes && (
              <button
                onClick={onToggleNodes}
                style={activePillStyle(!!showNodes)}
              >
                Nodes
              </button>
            )}
            {onToggleMarketplace && (
              <button
                onClick={onToggleMarketplace}
                style={activePillStyle(!!showMarketplace)}
              >
                Marketplace
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center" style={{ gap: "0.5rem" }}>
        {actions}
      </div>
    </header>
  );
}

function ViewDropdown({
  panel,
  onSelect,
  hasFlows,
  hasMarketplace,
  hasNodes,
}: {
  panel: Panel;
  onSelect: (panel: Panel) => void;
  hasFlows: boolean;
  hasMarketplace: boolean;
  hasNodes: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const options: { value: Panel; label: string }[] = [
    { value: "none", label: "Chat" },
  ];
  if (hasFlows) options.push({ value: "flows", label: "Flows" });
  if (hasNodes) options.push({ value: "nodes", label: "Nodes" });
  if (hasMarketplace) {
    options.push({ value: "marketplace", label: "Marketplace" });
  }
  const current = options.find((o) => o.value === panel) ?? options[0];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} style={pill}>
        {current.label}
        <ChevronDown
          size={16}
          style={{
            marginLeft: "4px",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            marginTop: "4px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            zIndex: 10,
            minWidth: "10rem",
            overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <MenuButton
              key={opt.value}
              label={opt.label}
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
