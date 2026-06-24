// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Share2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { pillTruncate } from "../../lib/pillStyle";

interface FlowToolbarProps {
  flowName: string;
  isPublished?: boolean;
  hasUnpublishedChanges?: boolean;
  duplicatePublishedFlowName?: string | null;
  description?: string;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDescriptionChange?: (next: string) => void;
  onShare?: () => Promise<boolean> | boolean;
  onCopy?: () => void;
  isDefault?: boolean;
  onSetAsDefault?: () => void;
  onDelete?: () => void;
}

const pillButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  padding: "4px 12px",
  fontSize: "0.8rem",
  fontWeight: 500,
  cursor: "pointer",
  borderRadius: "var(--radius-full)",
  fontFamily: "var(--font-sans)",
  ...pillTruncate,
};

const ICON_SIZE = 14;
const ICON_STROKE = 1.75;

export function FlowToolbar({
  flowName: _flowName,
  isPublished,
  hasUnpublishedChanges,
  duplicatePublishedFlowName,
  description,
  onPublish,
  onUnpublish,
  onDescriptionChange,
  onShare,
  onCopy,
  isDefault,
  onSetAsDefault,
  onDelete,
}: FlowToolbarProps) {
  const upToDate = !!isPublished && !hasUnpublishedChanges;
  const duplicateOfOther = !!duplicatePublishedFlowName;
  const publishDisabled = upToDate || duplicateOfOther;
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    if (!onShare) return;
    const ok = await onShare();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 10px",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      {onDescriptionChange && (
        <input
          value={description ?? ""}
          onChange={(e) =>
            onDescriptionChange(e.target.value)
          }
          placeholder="Description (shown in marketplace)"
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: "var(--bg-input)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "4px 10px",
            fontSize: "0.8rem",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        />
      )}

      {onPublish && (
        <button
          onClick={publishDisabled ? undefined : onPublish}
          disabled={publishDisabled}
          title={
            duplicateOfOther
              ? `Identical to “${duplicatePublishedFlowName}” already on marketplace`
              : upToDate
                ? "Marketplace is up to date with current draft"
                : isPublished
                  ? "Push current state to marketplace"
                  : "Publish current state to marketplace"
          }
          style={{
            ...pillButton,
            backgroundColor: publishDisabled
              ? "var(--bg-input)"
              : isPublished
                ? "var(--bg-input)"
                : "var(--accent)",
            color: publishDisabled
              ? "var(--text-secondary)"
              : isPublished
                ? "var(--text)"
                : "#fff",
            borderColor: publishDisabled
              ? "var(--border)"
              : isPublished
                ? "var(--border)"
                : "var(--accent)",
            cursor: publishDisabled ? "default" : "pointer",
            opacity: publishDisabled ? 0.6 : 1,
          }}
        >
          <Upload size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          {isPublished ? "Republish" : "Publish"}
        </button>
      )}

      {onUnpublish && isPublished && (
        <button
          onClick={onUnpublish}
          title="Remove from marketplace"
          style={{
            ...pillButton,
            color: "var(--text-secondary)",
          }}
        >
          <Globe size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Unpublish
        </button>
      )}

      {onShare && isPublished && (
        <button
          onClick={handleShare}
          title="Copy share link"
          style={{
            ...pillButton,
            color: "var(--text)",
          }}
        >
          {copied ? (
            <>
              <Check size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              Copied
            </>
          ) : (
            <>
              <Share2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              Share
            </>
          )}
        </button>
      )}
      {onCopy && (
        <button
          onClick={onCopy}
          title="Create a new copy of this flow"
          style={{
            ...pillButton,
            color: "var(--text)",
          }}
        >
          <Copy size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Copy
        </button>
      )}
      {onSetAsDefault && (
        <button
          onClick={onSetAsDefault}
          disabled={isDefault}
          title={
            isDefault
              ? "This is the default flow for new users"
              : "Make this the default flow for new users"
          }
          style={{
            ...pillButton,
            backgroundColor: isDefault
              ? "var(--accent)"
              : "var(--bg-input)",
            color: isDefault ? "#fff" : "var(--text)",
            borderColor: isDefault
              ? "var(--accent)"
              : "var(--border)",
            cursor: isDefault ? "default" : "pointer",
          }}
        >
          {isDefault ? (
            <>
              <Star
                size={ICON_SIZE}
                strokeWidth={ICON_STROKE}
                fill="currentColor"
              />
              Default
            </>
          ) : (
            <>
              <Star size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              Set as default
            </>
          )}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete this flow"
          style={{
            ...pillButton,
            backgroundColor: "var(--accent-error)",
            color: "#fff",
            borderColor: "var(--accent-error)",
          }}
        >
          <Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Delete flow
        </button>
      )}
    </div>
  );
}
