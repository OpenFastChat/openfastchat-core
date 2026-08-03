// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Public API of @openfastchat/ui — the shared, AGPL frontend building blocks
// (flow editor, chat UI, node renderers, stream parsing, data hooks) consumed
// by the self-host and hosted wrappers. Grows as packages are carved in.

// libs
export * from "./lib/stream";
export * from "./lib/welcomeThread";
export * from "./lib/compactDefaultPrompt";
export * from "./lib/captcha";
export * from "./lib/apiFetch";
export * from "./lib/notice";
export * from "./lib/activeFlow";
export * from "./lib/builtinFlows";

// data hooks
export * from "./hooks/useFlowHistory";
export * from "./hooks/useFlows";
export * from "./hooks/useThreads";
export * from "./hooks/useModels";
export * from "./hooks/useDocuments";
export * from "./hooks/useActiveFlow";
export * from "./hooks/useMarketplace";

// flow editor + shared UI primitives
export { FlowEditor } from "./components/flow/FlowEditor";
export { NodesPanel } from "./components/nodes/NodesPanel";
export { AutoTextarea } from "./components/AutoTextarea";
export { Tooltip } from "./components/Tooltip";
export * from "./lib/pillStyle";
export * from "./lib/share";

// chat engine + UI
export { useChat } from "./hooks/useChat";
export type { Message, ChatStatus } from "./hooks/useChat";
export * from "./lib/loginPrompt";
export * from "./lib/fuzzy";
export { ChatWindow } from "./components/ChatWindow";
export { MessageBubble } from "./components/MessageBubble";
export { ContextBlock } from "./components/ContextBlock";
export { ThinkingBlock } from "./components/ThinkingBlock";
export { InputBar } from "./components/InputBar";
export { NoticeModal } from "./components/NoticeModal";

// marketplace browse + shell support
export { MarketplacePanel } from "./components/marketplace/MarketplacePanel";
export { MarketplaceCard } from "./components/marketplace/MarketplaceCard";
export { MarketplaceBanner } from "./components/marketplace/MarketplaceBanner";
export { useIsMobile, useIsNarrow } from "./hooks/useIsMobile";
export * from "./hooks/usePanelState";
export * from "./lib/flowComparison";

// admin surface (shared by every wrapper; talks to /api/admin/*)
export { ProvidersSection } from "./components/admin/ProvidersSection";

// app shell: full chat orchestration + wrapper-injectable slots
export { ChatShell } from "./components/ChatShell";
export type { ShellUser, ChatShellProps } from "./components/ChatShell";
export { ShellHeader } from "./components/ShellHeader";
export { Sidebar } from "./components/Sidebar";
export { StatusBar } from "./components/StatusBar";
export { FlowEditorPanel } from "./components/panels/FlowEditorPanel";
export * from "./components/shellMenu";
