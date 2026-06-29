// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ModelInfo } from "../hooks/useModels";
import type { Message } from "../hooks/useChat";

export interface CommandContext {
  models: ModelInfo[];
  model: string;
  onModelChange: (model: string) => void;
  onUpload: () => void;
  onStop: () => void;
  onClearChat: () => void;
  onNewChat: () => void;
  onDeleteChat: () => void;
  onRenameChat: (title: string) => void;
  onNewFlow: () => void;
  onDeleteFlow: () => void;
  onRenameFlow: (name: string) => void;
  onToggleFlows: () => void;
  onToggleSidebar: () => void;
  onShowHelp: (msg: Message) => void;
}

export interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  hasArgs?: boolean;
  shortcut?: string;
  execute: (ctx: CommandContext, args: string) => void;
}

export const COMMANDS: SlashCommand[] = [
  {
    name: "new",
    aliases: ["n"],
    description: "Start a new chat",
    execute: (ctx) => ctx.onNewChat(),
  },
  {
    name: "delete",
    aliases: ["d"],
    description: "Delete current chat",
    execute: (ctx) => ctx.onDeleteChat(),
  },
  {
    name: "clear",
    aliases: ["c"],
    description: "Clear current chat messages",
    execute: (ctx) => ctx.onClearChat(),
  },
  {
    name: "rename",
    aliases: ["r"],
    description: "Rename current chat",
    hasArgs: true,
    execute: (ctx, args) => {
      ctx.onRenameChat(args.trim());
    },
  },
  {
    name: "model",
    aliases: ["m"],
    description: "Switch model",
    hasArgs: true,
    execute: (ctx, args) => {
      const query = args.trim().toLowerCase();
      if (!query) return;
      const match = ctx.models.find(
        (m) =>
          m.id.toLowerCase() === query ||
          m.label.toLowerCase() === query ||
          m.id.toLowerCase().includes(query) ||
          m.label.toLowerCase().includes(query),
      );
      if (match) ctx.onModelChange(match.id);
    },
  },
  {
    name: "upload",
    aliases: ["u"],
    description: "Upload a file",
    execute: (ctx) => ctx.onUpload(),
  },
  {
    name: "stop",
    aliases: [],
    description: "Stop streaming",
    shortcut: "Esc",
    execute: (ctx) => ctx.onStop(),
  },
  {
    name: "flows",
    aliases: ["f"],
    description: "Toggle flow editor",
    execute: (ctx) => ctx.onToggleFlows(),
  },
  {
    name: "newflow",
    aliases: ["nf"],
    description: "Create a new flow (copy of current)",
    execute: (ctx) => ctx.onNewFlow(),
  },
  {
    name: "deleteflow",
    aliases: ["df"],
    description: "Delete current flow",
    execute: (ctx) => ctx.onDeleteFlow(),
  },
  {
    name: "renameflow",
    aliases: ["rf"],
    description: "Rename current flow",
    hasArgs: true,
    execute: (ctx, args) => ctx.onRenameFlow(args.trim()),
  },
  {
    name: "menu",
    aliases: ["chats"],
    description: "Toggle chat sidebar",
    execute: (ctx) => ctx.onToggleSidebar(),
  },
  {
    name: "help",
    aliases: ["h", "?"],
    description: "Show available commands",
    execute: (ctx) => {
      const lines = COMMANDS.map((c) => {
        const aliases =
          c.aliases.length > 0
            ? ` (${c.aliases.map((a) => "/" + a).join(", ")})`
            : "";
        const shortcut = c.shortcut ? ` [${c.shortcut}]` : "";
        return `\`/${c.name}\`${aliases}${shortcut} — ${c.description}`;
      });
      ctx.onShowHelp({
        id: `help-${Date.now()}`,
        role: "assistant",
        content: "**Available commands:**\n" +
          lines.join("\n"),
      });
    },
  },
];

function matchesPrefix(
  cmd: SlashCommand,
  prefix: string,
): boolean {
  const lower = prefix.toLowerCase();
  if (cmd.name.startsWith(lower)) return true;
  return cmd.aliases.some(
    (a) => a.startsWith(lower),
  );
}

export function getMatchingCommands(
  input: string,
): SlashCommand[] {
  if (!input.startsWith("/")) return [];
  const spaceIndex = input.indexOf(" ");
  const prefix =
    spaceIndex === -1
      ? input.slice(1)
      : input.slice(1, spaceIndex);
  if (spaceIndex !== -1) {
    // Already has args — only match exact command
    const exact = COMMANDS.find(
      (c) =>
        c.name === prefix.toLowerCase() ||
        c.aliases.includes(prefix.toLowerCase()),
    );
    return exact ? [exact] : [];
  }
  if (prefix === "") return COMMANDS;
  return COMMANDS.filter(
    (c) => matchesPrefix(c, prefix),
  );
}

export function getFilteredModels(
  input: string,
  models: ModelInfo[],
): ModelInfo[] | null {
  const match = input.match(
    /^\/(model|m)(\s+(.*))?$/i,
  );
  if (!match) return null;
  const query = (match[3] ?? "").trim().toLowerCase();
  if (!query) return models;
  return models.filter(
    (m) =>
      m.id.toLowerCase().includes(query) ||
      m.label.toLowerCase().includes(query),
  );
}

function resolveCommand(
  name: string,
): SlashCommand | undefined {
  const lower = name.toLowerCase();
  return COMMANDS.find(
    (c) =>
      c.name === lower ||
      c.aliases.includes(lower),
  );
}

export function parseAndExecute(
  input: string,
  ctx: CommandContext,
): boolean {
  if (!input.startsWith("/")) return false;
  const trimmed = input.slice(1);
  const spaceIndex = trimmed.indexOf(" ");
  const name =
    spaceIndex === -1
      ? trimmed
      : trimmed.slice(0, spaceIndex);
  const args =
    spaceIndex === -1
      ? ""
      : trimmed.slice(spaceIndex + 1);

  const cmd = resolveCommand(name);
  if (!cmd) return false;

  cmd.execute(ctx, args);
  return true;
}
