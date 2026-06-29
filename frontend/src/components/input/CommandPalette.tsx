// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ModelInfo } from "../../hooks/useModels";

interface PaletteCommand {
  name: string;
  description: string;
  aliases: string[];
  shortcut?: string;
  hasArgs?: boolean;
}

interface Props {
  showingModels: boolean;
  models: ModelInfo[];
  commands: PaletteCommand[];
  selectedIndex: number;
  onHover: (index: number) => void;
  onSelectModel: (m: ModelInfo) => void;
  onSelectCommand: (cmd: PaletteCommand) => void;
}

function itemStyle(
  selected: boolean,
  isFirst: boolean,
  isLast: boolean,
): React.CSSProperties {
  return {
    padding: "0.5rem 0.75rem",
    cursor: "pointer",
    backgroundColor: selected ? "var(--bg-hover)" : "transparent",
    borderLeft: selected
      ? "3px solid var(--accent)"
      : "3px solid transparent",
    display: "flex",
    gap: "0.75rem",
    fontSize: "0.85rem",
    borderRadius: isFirst
      ? "var(--radius-md) var(--radius-md) 0 0"
      : isLast
        ? "0 0 var(--radius-md) var(--radius-md)"
        : "0",
  };
}

export function CommandPalette({
  showingModels,
  models,
  commands,
  selectedIndex,
  onHover,
  onSelectModel,
  onSelectCommand,
}: Props) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: "1rem",
        right: "1rem",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        marginBottom: "4px",
        maxHeight: "400px",
        overflowY: "auto",
        zIndex: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {showingModels
        ? models.map((m, i) => (
            <div
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectModel(m);
              }}
              onMouseEnter={() => onHover(i)}
              style={itemStyle(
                i === selectedIndex,
                i === 0,
                i === models.length - 1,
              )}
            >
              <span
                style={{
                  color: "var(--accent-text)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {m.id}
              </span>
              {m.label !== m.id && (
                <span
                  style={{
                    color: "var(--text-secondary)",
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.label}
                </span>
              )}
            </div>
          ))
        : commands.map((cmd, i) => (
            <div
              key={cmd.name}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectCommand(cmd);
              }}
              onMouseEnter={() => onHover(i)}
              style={itemStyle(
                i === selectedIndex,
                i === 0,
                i === commands.length - 1,
              )}
            >
              <span
                style={{
                  color: "var(--accent-text)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                /{cmd.name}
              </span>
              {cmd.aliases.length > 0 && (
                <span
                  style={{
                    color: "var(--text-secondary)",
                    opacity: 0.6,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {cmd.aliases.map((a) => "/" + a).join(" ")}
                </span>
              )}
              {cmd.shortcut && (
                <span
                  style={{
                    color: "var(--text-secondary)",
                    opacity: 0.6,
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.85em",
                    padding: "1px 6px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {cmd.shortcut}
                </span>
              )}
              <span
                style={{
                  color: "var(--text-secondary)",
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {cmd.description}
              </span>
            </div>
          ))}
    </div>
  );
}
