// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type {
  Notice,
  NoticeVariant,
} from "../lib/notice";
import { sendIssueReport } from "../lib/notice";

interface Props {
  error: Notice;
  onClose: () => void;
}

type SendState = "idle" | "sending" | "sent" | "failed";

interface VariantStyle {
  showIcon: boolean;
  borderColor: string;
  prompt: string;
  placeholder: string;
  submitLabel: string;
  sentMessage: string;
  failedMessage: string;
}

const VARIANTS: Record<NoticeVariant, VariantStyle> = {
  error: {
    showIcon: true,
    borderColor: "var(--accent-error)",
    prompt: "Want to report this? Add context if you like.",
    placeholder: "What were you doing when this happened?",
    submitLabel: "Report",
    sentMessage: "Thanks — issue reported.",
    failedMessage: "Couldn't send the report. Try again?",
  },
  contact: {
    showIcon: false,
    borderColor: "var(--border)",
    prompt: "We read every message.",
    placeholder: "Your message…",
    submitLabel: "Send",
    sentMessage: "Thanks — message sent.",
    failedMessage: "Couldn't send your message. Try again?",
  },
};

export function NoticeModal({ error, onClose }: Props) {
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SendState>("idle");
  const canReport = error.canReport !== false;
  const variant = VARIANTS[error.variant ?? "error"];

  const handleReport = async () => {
    setState("sending");
    try {
      await sendIssueReport(error, comment);
      setState("sent");
      window.setTimeout(onClose, 1200);
    } catch {
      setState("failed");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: `1px solid ${variant.borderColor}`,
          borderRadius: "var(--radius-lg)",
          padding: canReport ? "1.5rem 1.75rem" : "1rem 1.25rem",
          width: canReport ? "min(440px, 92vw)" : "min(520px, 92vw)",
          color: "var(--text)",
          fontFamily: "var(--font-sans)",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        }}
      >
        {canReport ? (
          <ReportableLayout
            message={error.message}
            comment={comment}
            setComment={setComment}
            state={state}
            handleReport={handleReport}
            onClose={onClose}
            variant={variant}
          />
        ) : (
          <CompactLayout
            message={error.message}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function CompactLayout({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
      }}
    >
      <AlertCircle
        size={20}
        strokeWidth={2}
        color="var(--accent-error)"
        style={{ flexShrink: 0 }}
      />
      <div
        style={{
          flex: 1,
          fontSize: "0.9rem",
          color: "var(--text)",
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {message}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          backgroundColor: "var(--accent)",
          color: "#fff",
          border: "none",
          padding: "6px 14px",
          borderRadius: "var(--radius-md)",
          fontSize: "0.85rem",
          fontWeight: 500,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Got it
      </button>
    </div>
  );
}

function ReportableLayout({
  message,
  comment,
  setComment,
  state,
  handleReport,
  onClose,
  variant,
}: {
  message: string;
  comment: string;
  setComment: (s: string) => void;
  state: SendState;
  handleReport: () => void;
  onClose: () => void;
  variant: VariantStyle;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-start",
          marginBottom: "1.25rem",
        }}
      >
        {variant.showIcon && (
          <AlertCircle
            size={22}
            strokeWidth={2}
            color="var(--accent-error)"
            style={{ flexShrink: 0, marginTop: "1px" }}
          />
        )}
        <div
          style={{
            fontSize: "0.95rem",
            color: "var(--text)",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {message}
        </div>
      </div>

      <div
        style={{
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          marginBottom: "0.5rem",
        }}
      >
        {variant.prompt}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={variant.placeholder}
        style={{
          width: "100%",
          backgroundColor: "var(--bg-input)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "8px 10px",
          fontSize: "0.85rem",
          fontFamily: "var(--font-sans)",
          resize: "vertical",
          marginBottom: "1rem",
          boxSizing: "border-box",
        }}
      />

      {state === "sent" && (
        <div
          style={{
            color: "var(--accent-text)",
            fontSize: "0.85rem",
            marginBottom: "0.75rem",
          }}
        >
          {variant.sentMessage}
        </div>
      )}
      {state === "failed" && (
        <div
          style={{
            color: "var(--accent-error)",
            fontSize: "0.85rem",
            marginBottom: "0.75rem",
          }}
        >
          {variant.failedMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            backgroundColor: "var(--bg-input)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            padding: "7px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleReport}
          disabled={state === "sending" || state === "sent"}
          style={{
            backgroundColor: "var(--accent)",
            color: "#fff",
            border: "none",
            padding: "7px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor:
              state === "sending" || state === "sent"
                ? "not-allowed"
                : "pointer",
            opacity:
              state === "sending" || state === "sent" ? 0.6 : 1,
          }}
        >
          {state === "sending"
            ? "Sending…"
            : state === "sent"
              ? "Sent"
              : variant.submitLabel}
        </button>
      </div>
    </>
  );
}
