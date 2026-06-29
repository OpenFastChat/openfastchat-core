// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatStatus, Message } from "../hooks/useChat";
import type { ModelInfo } from "../hooks/useModels";
import type { DocumentInfo } from "../hooks/useDocuments";
import type { FlowOption } from "../lib/builtinFlows";
import {
  type CommandContext,
  getMatchingCommands,
  getFilteredModels,
  parseAndExecute,
} from "../lib/commands";
import { CommandPalette } from "./input/CommandPalette";
import { AttachmentChip } from "./input/AttachmentChip";
import { pillTruncate } from "../lib/pillStyle";
import { useInputDraft } from "../hooks/useInputDraft";
import { useTypeToFocus } from "../hooks/useTypeToFocus";

interface InputBarProps {
  status: ChatStatus;
  disabled: boolean;
  model: string;
  models: ModelInfo[];
  messages: Message[];
  documents: DocumentInfo[];
  editDraft: string;
  onEditDraftConsumed: () => void;
  activeFlowId: string;
  flowOptions: FlowOption[];
  onFlowChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onSend: (content: string) => void;
  onStop: () => void;
  onUpload: (file: File) => void;
  onDeleteDocument: (id: string) => void;
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
  mobile?: boolean;
  draftKey?: string;
}

const PILL_HEIGHT = "28px";

const SELECT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--bg-input)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  padding: "4px 10px",
  height: PILL_HEIGHT,
  fontFamily: "var(--font-sans)",
  fontSize: "0.8rem",
  outline: "none",
  borderRadius: "var(--radius-full)",
  cursor: "pointer",
  ...pillTruncate,
};

const PILL_BASE: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: "0.8rem",
  fontWeight: 500,
  height: PILL_HEIGHT,
  borderRadius: "var(--radius-full)",
  border: "1px solid var(--border)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  ...pillTruncate,
};

export function InputBar({
  status,
  disabled,
  model,
  models,
  messages,
  documents,
  editDraft,
  onEditDraftConsumed,
  activeFlowId,
  flowOptions,
  onFlowChange,
  onModelChange,
  onSend,
  onStop,
  onUpload,
  onDeleteDocument,
  onClearChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onNewFlow,
  onDeleteFlow,
  onRenameFlow,
  onToggleFlows,
  onToggleSidebar,
  onShowHelp,
  mobile,
  draftKey,
}: InputBarProps) {
  const [value, setValue] = useInputDraft(draftKey);
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedDraft = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isStreaming =
    status === "streaming" || status === "submitting";

  useTypeToFocus(textareaRef);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 400) + "px";
  };

  useEffect(resizeTextarea, [value]);

  useEffect(() => {
    if (editDraft) {
      setValue(editDraft);
      onEditDraftConsumed();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [editDraft, onEditDraftConsumed, setValue]);

  const userHistory = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .reverse(),
    [messages],
  );

  const commandContext: CommandContext = useMemo(
    () => ({
      models,
      model,
      onModelChange,
      onUpload: () => fileRef.current?.click(),
      onStop,
      onClearChat,
      onNewChat,
      onDeleteChat,
      onRenameChat,
      onNewFlow,
      onDeleteFlow,
      onRenameFlow,
      onToggleFlows,
      onToggleSidebar,
      onShowHelp,
    }),
    [
      models,
      model,
      onModelChange,
      onStop,
      onClearChat,
      onNewChat,
      onDeleteChat,
      onRenameChat,
      onNewFlow,
      onDeleteFlow,
      onRenameFlow,
      onToggleFlows,
      onToggleSidebar,
      onShowHelp,
    ],
  );

  const matchedCommands = useMemo(
    () => getMatchingCommands(value),
    [value],
  );
  const filteredModels = useMemo(
    () => getFilteredModels(value, models),
    [value, models],
  );
  const showingModels = filteredModels !== null;
  const dropdownItems = showingModels ? filteredModels : matchedCommands;
  const showDropdown =
    value.startsWith("/") && dropdownItems.length > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [value]);

  const clearInput = () => {
    setValue("");
    setHistoryIndex(-1);
    savedDraft.current = "";
  };

  const handleSend = () => {
    const content = value.trim();
    if (!content) return;

    if (content.toLowerCase() === "/stop") {
      onStop();
      clearInput();
      return;
    }
    if (isStreaming || disabled) return;
    if (content.startsWith("/")) {
      const executed = parseAndExecute(content, commandContext);
      if (executed) {
        clearInput();
        return;
      }
    }
    clearInput();
    onSend(content);
  };

  const selectModelItem = (m: ModelInfo) => {
    onModelChange(m.id);
    clearInput();
  };

  const selectCommandItem = (cmd: { name: string; hasArgs?: boolean }) => {
    if (cmd.hasArgs) {
      setValue(`/${cmd.name} `);
      textareaRef.current?.focus();
      return;
    }
    setValue(`/${cmd.name}`);
    requestAnimationFrame(() => {
      const executed = parseAndExecute(`/${cmd.name}`, commandContext);
      if (executed) clearInput();
    });
  };

  const handleDropdownSelect = () => {
    const clamped = Math.min(selectedIndex, dropdownItems.length - 1);
    if (clamped < 0) return;
    const item = dropdownItems[clamped];
    if (showingModels) {
      selectModelItem(item as ModelInfo);
    } else {
      selectCommandItem(item as { name: string; hasArgs?: boolean });
    }
  };

  const handleHistoryUp = () => {
    if (historyIndex === -1) savedDraft.current = value;
    const next = Math.min(historyIndex + 1, userHistory.length - 1);
    setHistoryIndex(next);
    setValue(userHistory[next]);
  };

  const handleHistoryDown = () => {
    const next = historyIndex - 1;
    setHistoryIndex(next);
    setValue(next === -1 ? savedDraft.current : userHistory[next]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : dropdownItems.length - 1,
        );
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i < dropdownItems.length - 1 ? i + 1 : 0,
        );
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleDropdownSelect();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        return;
      }
    }

    if (e.key === "ArrowUp" && userHistory.length > 0) {
      const el = textareaRef.current;
      if (!el || el.selectionStart === 0) {
        e.preventDefault();
        handleHistoryUp();
        return;
      }
    }
    if (e.key === "ArrowDown" && historyIndex >= 0) {
      const el = textareaRef.current;
      if (!el || el.selectionStart === el.value.length) {
        e.preventDefault();
        handleHistoryDown();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showDropdown && showingModels) {
        handleDropdownSelect();
      } else {
        handleSend();
      }
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = "";
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
        padding: "0.75rem 1rem",
        position: "relative",
      }}
    >
      {showDropdown && (
        <CommandPalette
          showingModels={showingModels}
          models={filteredModels ?? []}
          commands={matchedCommands}
          selectedIndex={selectedIndex}
          onHover={setSelectedIndex}
          onSelectModel={selectModelItem}
          onSelectCommand={selectCommandItem}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          border: `1px solid ${
            focused ? "var(--border-focus)" : "var(--border)"
          }`,
          backgroundColor: "var(--bg-input)",
          borderRadius: "var(--radius-md)",
          opacity: isStreaming || disabled ? 0.5 : 1,
          boxShadow: focused
            ? "0 0 0 2px rgba(108,138,255,0.15)"
            : "none",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            disabled
              ? "Rate limit reached..."
              : "Message... (type / for commands)"
          }
          disabled={isStreaming || disabled}
          rows={1}
          className="w-full resize-none overflow-auto"
          style={{
            padding: "0.6rem 0.75rem",
            minHeight: "2.5rem",
            maxHeight: "400px",
            backgroundColor: "transparent",
            color: "var(--text)",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-sans)",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            whiteSpace: value ? "pre-wrap" : "nowrap",
            overflowX: "hidden",
          }}
        />
        {isStreaming ? (
          <SendButton variant="stop" onClick={onStop} />
        ) : (
          <SendButton
            variant="send"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
          />
        )}
      </div>

      {documents.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.3rem",
            marginTop: "0.4rem",
          }}
        >
          {documents.map((doc) => (
            <AttachmentChip
              key={doc.id}
              filename={doc.filename}
              onDelete={() => onDeleteDocument(doc.id)}
            />
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between"
        style={{ marginTop: "0.5rem" }}
      >
        <div
          className="flex items-center flex-wrap"
          style={{ gap: "0.4rem" }}
        >
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            aria-label="Select model"
            style={{
              ...SELECT_STYLE,
              minWidth: mobile ? 0 : "12rem",
              flex: mobile ? "1 1 0" : undefined,
            }}
          >
            {models.length === 0 && (
              <option value="" disabled>
                Loading models...
              </option>
            )}
            {models.map((m) => (
              <option
                key={m.id}
                value={m.id}
                style={{
                  backgroundColor: "var(--bg-input)",
                  color: "var(--text)",
                }}
              >
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={activeFlowId}
            onChange={(e) => onFlowChange(e.target.value)}
            aria-label="Select flow"
            style={{
              ...SELECT_STYLE,
              minWidth: mobile ? 0 : "8rem",
              flex: mobile ? "1 1 0" : undefined,
            }}
          >
            {flowOptions.map((f) => (
              <option
                key={f.id}
                value={f.id}
                style={{
                  backgroundColor: "var(--bg-input)",
                  color: "var(--text)",
                }}
              >
                {f.displayName}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            id="inputbar-file-upload"
            type="file"
            accept=".txt,.md,.markdown,.pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <label
            htmlFor="inputbar-file-upload"
            title="Upload document"
            style={{
              ...PILL_BASE,
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
              display: "inline-flex",
              alignItems: "center",
              userSelect: "none",
            }}
          >
            Upload
          </label>
        </div>
      </div>

    </div>
  );
}

interface SendButtonProps {
  variant: "send" | "stop";
  onClick: () => void;
  disabled?: boolean;
}

function SendButton({ variant, onClick, disabled }: SendButtonProps) {
  const isStop = variant === "stop";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        margin: "0.4rem 0.5rem 0.4rem 0",
        padding: "0.35rem 0.85rem",
        backgroundColor: isStop ? "var(--accent-error)" : "var(--accent)",
        color: "#fff",
        border: "none",
        borderRadius: "var(--radius-md)",
        fontSize: "0.8rem",
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        flexShrink: 0,
        fontFamily: "var(--font-sans)",
      }}
    >
      {isStop ? "Stop" : "Send"}
    </button>
  );
}
