// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { Check, Plus } from "lucide-react";
import {
  NODE_CATALOG,
  type NodeCatalogEntry,
} from "../flow/nodes/nodeCatalog";
import {
  effectiveMenu,
  useNodeMenu,
  useUpdateNodeMenu,
} from "../../hooks/useNodeMenu";

interface Props {
  onUse: (nodeType: string) => void;
}

export function NodesPanel({ onUse }: Props) {
  const { data: storedMenu } = useNodeMenu();
  const updateMenu = useUpdateNodeMenu();
  const menu = effectiveMenu(storedMenu);
  const inMenu = new Set(menu);

  const toggle = (type: string) => {
    const next = inMenu.has(type)
      ? menu.filter((t) => t !== type)
      : [...menu, type];
    updateMenu.mutate(next);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            color: "var(--text)",
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          Nodes
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.78rem",
          }}
        >
          Add to your menu, or use a node in the current flow.
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: "1rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
            gap: "0.75rem",
          }}
        >
          {NODE_CATALOG.map((node) => (
            <NodeCard
              key={node.type}
              node={node}
              inMenu={inMenu.has(node.type)}
              onToggle={() => toggle(node.type)}
              onUse={() => onUse(node.type)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const pillBase: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: "0.75rem",
  fontWeight: 500,
  borderRadius: "var(--radius-full)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontFamily: "var(--font-sans)",
};

function NodeCard({
  node,
  inMenu,
  onToggle,
  onUse,
}: {
  node: NodeCatalogEntry;
  inMenu: boolean;
  onToggle: () => void;
  onUse: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          color: "var(--text)",
          fontWeight: 600,
          fontSize: "0.9rem",
          fontFamily: "var(--font-mono)",
        }}
      >
        {node.label}
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          flex: 1,
        }}
      >
        {node.description}
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button
          onClick={onUse}
          style={{
            ...pillBase,
            backgroundColor: "var(--accent)",
            color: "#fff",
            border: "1px solid var(--accent)",
          }}
        >
          Use
        </button>
        <button
          onClick={onToggle}
          style={{
            ...pillBase,
            backgroundColor: inMenu ? "var(--bg-input)" : "transparent",
            color: inMenu ? "var(--text)" : "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {inMenu ? <Check size={13} /> : <Plus size={13} />}
          {inMenu ? "In menu" : "Add to menu"}
        </button>
      </div>
    </div>
  );
}
