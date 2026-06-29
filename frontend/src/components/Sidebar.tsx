// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Thread } from "../hooks/useThreads";
import type { FlowOption } from "../lib/builtinFlows";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string;
  editingThreadId: string | null;
  flowOptions: FlowOption[];
  activeFlowId: string;
  editingFlowId: string | null;
  mobile?: boolean;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onEditingDone: () => void;
  onSelectFlow: (id: string) => void;
  onNewFlow: () => void;
  onDeleteFlow: (id: string) => void;
  onRenameFlow: (id: string, name: string) => void;
  onEditingFlowDone: () => void;
  onClose?: () => void;
}

export function Sidebar({
  threads,
  activeThreadId,
  editingThreadId,
  flowOptions,
  activeFlowId,
  editingFlowId,
  mobile,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onRenameThread,
  onEditingDone,
  onSelectFlow,
  onNewFlow,
  onDeleteFlow,
  onRenameFlow,
  onEditingFlowDone,
  onClose,
}: SidebarProps) {
  const mobileStyle: React.CSSProperties = mobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
      }
    : {};

  return (
    <>
      {mobile && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 39,
          }}
        />
      )}
      <aside
        className="flex flex-col"
        style={{
          width: "260px",
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          height: "100%",
          overflow: "hidden",
          ...mobileStyle,
        }}
      >
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => {
            onNewChat();
            if (mobile && onClose) onClose();
          }}
          style={{
            width: "100%",
            padding: "8px 12px",
            backgroundColor: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + New chat
        </button>
      </div>

      <div
        className="flex flex-col"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 0",
        }}
      >
        {threads.map((thread) => (
          <ListItem
            key={thread.id}
            label={thread.title || "New chat"}
            active={thread.id === activeThreadId}
            forceEdit={thread.id === editingThreadId}
            onSelect={() => {
              onSelectThread(thread.id);
              if (mobile && onClose) onClose();
            }}
            onDelete={() => onDeleteThread(thread.id)}
            onRename={(title) => {
              onRenameThread(thread.id, title);
              onEditingDone();
            }}
            onEditCancel={onEditingDone}
          />
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "10px 12px 4px",
        }}
      >
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Flows
        </span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        <button
          onClick={onNewFlow}
          style={{
            width: "100%",
            padding: "8px 12px",
            backgroundColor: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + New flow
        </button>
      </div>
      <div
        className="flex flex-col"
        style={{
          maxHeight: "30vh",
          overflowY: "auto",
          padding: "0 0 8px",
        }}
      >
        {flowOptions.map((flow) => (
          <ListItem
            key={flow.id}
            label={flow.displayName}
            active={flow.id === activeFlowId}
            forceEdit={flow.id === editingFlowId}
            canDelete={
              !flow.id.startsWith("__") && flow.editable
            }
            onSelect={() => {
              onSelectFlow(flow.id);
              if (mobile && onClose) onClose();
            }}
            onDelete={() => onDeleteFlow(flow.id)}
            onRename={(name) => {
              onRenameFlow(flow.id, name);
              onEditingFlowDone();
            }}
            onEditCancel={onEditingFlowDone}
          />
        ))}
      </div>
    </aside>
    </>
  );
}

function ListItem({
  label,
  active,
  forceEdit,
  canDelete = true,
  onSelect,
  onDelete,
  onRename,
  onEditCancel,
}: {
  label: string;
  active: boolean;
  forceEdit: boolean;
  canDelete?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (value: string) => void;
  onEditCancel: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(label);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const prevForceEdit = useRef(false);
  if (forceEdit && !prevForceEdit.current) {
    startEdit();
  }
  prevForceEdit.current = forceEdit;

  const commitEdit = () => {
    setEditing(false);
    onEditCancel();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    }
  };

  return (
    <div
      onClick={() => {
        if (!editing) onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (canDelete) startEdit();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center"
      style={{
        padding: "8px 12px",
        margin: "1px 6px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        backgroundColor: active
          ? "var(--bg-hover)"
          : hovered
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        gap: "8px",
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            padding: "2px 6px",
            outline: "none",
          }}
        />
      ) : (
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--text)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
          }}
        >
          {label}
        </span>
      )}

      {hovered && !editing && canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "2px 4px",
            fontSize: "0.8rem",
            flexShrink: 0,
          }}
          title="Delete"
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
