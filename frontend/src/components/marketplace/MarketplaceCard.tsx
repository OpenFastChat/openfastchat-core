// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Share2,
} from "lucide-react";
import type { MarketplaceFlow } from "../../hooks/useMarketplace";
import { copyShareLink } from "../../lib/share";
import { pillTruncate } from "../../lib/pillStyle";

interface Props {
  flow: MarketplaceFlow;
  selected: boolean;
  inMultiSelect: boolean;
  onUse: () => void;
  onCopy: () => void;
  onToggleSelect: () => void;
  onVote: (vote: -1 | 0 | 1) => void;
}

export function MarketplaceCard({
  flow,
  selected,
  inMultiSelect,
  onUse,
  onCopy,
  onToggleSelect,
  onVote,
}: Props) {
  const isUp = flow.current_user_vote === 1;
  const isDown = flow.current_user_vote === -1;
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const ok = await copyShareLink(flow.id);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: selected
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            color: "var(--text)",
            fontWeight: 600,
            fontSize: "0.95rem",
            flex: 1,
            ...pillTruncate,
          }}
        >
          {flow.name}
        </div>
      </div>

      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.75rem",
          ...pillTruncate,
        }}
      >
        by {flow.author_display_name}
      </div>

      <div
        style={{
          color: "var(--text)",
          fontSize: "0.8rem",
          flex: 1,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
        }}
      >
        {flow.description ?? (
          <span
            style={{ color: "var(--text-placeholder)" }}
          >
            No description
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.4rem",
          rowGap: "0.4rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <VoteButton
            active={isUp}
            icon={<ChevronUp size={14} strokeWidth={2.25} />}
            count={flow.up_count}
            color="var(--accent-success)"
            onClick={() => onVote(isUp ? 0 : 1)}
          />
          <VoteButton
            active={isDown}
            icon={<ChevronDown size={14} strokeWidth={2.25} />}
            count={flow.down_count}
            color="var(--accent-error)"
            onClick={() => onVote(isDown ? 0 : -1)}
          />
          <button
            onClick={handleShare}
            title="Copy share link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 9px",
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--bg-input)",
              color: copied
                ? "var(--accent-success)"
                : "var(--text-secondary)",
            }}
          >
            {copied ? (
              <Check size={13} strokeWidth={2} />
            ) : (
              <Share2 size={13} strokeWidth={1.75} />
            )}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
        <button
          onClick={onToggleSelect}
          style={{
            ...pillStyle,
            backgroundColor: inMultiSelect
              ? "var(--accent)"
              : "var(--bg-input)",
            color: inMultiSelect
              ? "#fff"
              : "var(--text-secondary)",
            borderColor: inMultiSelect
              ? "var(--accent)"
              : "var(--border)",
          }}
          title="Add to comparison"
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {inMultiSelect ? (
              <>
                <Check size={12} strokeWidth={2} />
                Added
              </>
            ) : (
              <>
                <Plus size={12} strokeWidth={2} />
                Compare
              </>
            )}
          </span>
        </button>
        <button
          onClick={onCopy}
          title="Copy as your own flow"
          style={{
            ...pillStyle,
            backgroundColor: "var(--bg-input)",
            color: "var(--text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Copy size={12} strokeWidth={2} />
          Copy
        </button>
        <button
          onClick={onUse}
          style={{
            ...pillStyle,
            backgroundColor: "var(--accent)",
            color: "#fff",
            borderColor: "var(--accent)",
          }}
        >
          Use
        </button>
        </div>
      </div>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "0.75rem",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-full)",
  ...pillTruncate,
};

function VoteButton({
  active,
  icon,
  count,
  color,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 9px",
        fontFamily: "var(--font-sans)",
        fontSize: "0.75rem",
        fontWeight: 500,
        lineHeight: 1,
        cursor: "pointer",
        border: active
          ? `1px solid ${color}`
          : "1px solid var(--border)",
        borderRadius: "var(--radius-full)",
        backgroundColor: active
          ? color
          : "var(--bg-input)",
        color: active ? "#0a0a0f" : "var(--text-secondary)",
      }}
    >
      {icon}
      <span>{count}</span>
    </button>
  );
}
