// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from "react";
import {
  useMarketplaceFlows,
  useMarketplaceSearch,
  useVoteFlow,
  type MarketplaceFlow,
  type MarketplaceSort,
} from "../../hooks/useMarketplace";
import { RefreshCw } from "lucide-react";
import { MarketplaceCard } from "./MarketplaceCard";
import { fuzzyMatchAny } from "../../lib/fuzzy";

interface Props {
  multiSelectIds: string[];
  onToggleMultiSelect: (id: string) => void;
  onUseSingle: (id: string) => void;
  onUseMulti: (ids: string[]) => void;
  onCopyFlow: (flow: MarketplaceFlow) => void;
  onClearMulti: () => void;
}

export function MarketplacePanel({
  multiSelectIds,
  onToggleMultiSelect,
  onUseSingle,
  onUseMulti,
  onCopyFlow,
  onClearMulti,
}: Props) {
  const [sort, setSort] = useState<MarketplaceSort>(
    () =>
      (localStorage.getItem(
        "marketplaceSort",
      ) as MarketplaceSort | null) ?? "top",
  );
  const flowsQuery = useMarketplaceFlows(sort);
  const vote = useVoteFlow();
  const [filter, setFilter] = useState("");
  const [submitted, setSubmitted] = useState("");
  const searchQuery = useMarketplaceSearch(submitted);

  const visible: MarketplaceFlow[] = useMemo(() => {
    const local = filter.trim()
      ? (flowsQuery.data ?? []).filter((f) =>
          fuzzyMatchAny(filter, [
            f.name,
            f.description,
            f.author_display_name,
          ]),
        )
      : (flowsQuery.data ?? []);
    const useBackend =
      submitted.trim().length >= 2 &&
      searchQuery.isSuccess &&
      searchQuery.data;
    if (useBackend) {
      const seen = new Set<string>();
      const merged: MarketplaceFlow[] = [];
      for (const f of searchQuery.data ?? []) {
        seen.add(f.id);
        merged.push(f);
      }
      for (const f of local) {
        if (!seen.has(f.id)) merged.push(f);
      }
      return merged;
    }
    return local;
  }, [
    flowsQuery.data,
    filter,
    submitted,
    searchQuery.isSuccess,
    searchQuery.data,
  ]);
  const filtered = visible;
  const searching =
    submitted.trim().length >= 2 && searchQuery.isFetching;

  const setSortPersisted = (next: MarketplaceSort) => {
    localStorage.setItem("marketplaceSort", next);
    setSort(next);
  };

  const selectedSet = useMemo(
    () => new Set(multiSelectIds),
    [multiSelectIds],
  );

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
          Marketplace
        </div>
        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            overflow: "hidden",
            backgroundColor: "var(--bg-input)",
          }}
        >
          {(["top", "new", "hot"] as MarketplaceSort[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setSortPersisted(s)}
                style={{
                  backgroundColor:
                    sort === s
                      ? "var(--accent)"
                      : "transparent",
                  color:
                    sort === s
                      ? "#fff"
                      : "var(--text-secondary)",
                  border: "none",
                  padding: "3px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            ),
          )}
        </div>
        <button
          onClick={() => {
            void flowsQuery.refetch();
            if (submitted.trim().length >= 2) {
              void searchQuery.refetch();
            }
          }}
          disabled={flowsQuery.isFetching}
          title="Refresh"
          aria-label="Refresh marketplace"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--bg-input)",
            color: "var(--text-secondary)",
            cursor: flowsQuery.isFetching
              ? "not-allowed"
              : "pointer",
            opacity: flowsQuery.isFetching ? 0.6 : 1,
            fontSize: "0.85rem",
            lineHeight: 1,
            fontFamily: "var(--font-sans)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              animation: flowsQuery.isFetching
                ? "spin 0.9s linear infinite"
                : undefined,
            }}
          >
            <RefreshCw size={14} strokeWidth={1.75} />
          </span>
        </button>
        <div
          style={{
            position: "relative",
            flex: 1,
            maxWidth: "20rem",
          }}
        >
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSubmitted(filter.trim());
              } else if (e.key === "Escape") {
                setFilter("");
                setSubmitted("");
              }
            }}
            placeholder="Search… (Enter for full search)"
            style={{
              width: "100%",
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
          {searching && (
            <div
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.7rem",
                color: "var(--text-placeholder)",
              }}
            >
              …
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {multiSelectIds.length > 0 && (
          <>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.8rem",
              }}
            >
              {multiSelectIds.length} selected
            </span>
            <button
              onClick={onClearMulti}
              style={pillSecondary}
            >
              Clear
            </button>
            <button
              onClick={() => onUseMulti(multiSelectIds)}
              disabled={multiSelectIds.length < 2}
              style={{
                ...pillPrimary,
                opacity:
                  multiSelectIds.length < 2 ? 0.5 : 1,
                cursor:
                  multiSelectIds.length < 2
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Compare
            </button>
          </>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "1rem",
        }}
      >
        {flowsQuery.isLoading && (
          <div
            style={{
              color: "var(--text-secondary)",
              padding: "1rem",
            }}
          >
            Loading…
          </div>
        )}
        {flowsQuery.isError && (
          <div
            style={{
              color: "var(--accent-error)",
              padding: "1rem",
            }}
          >
            Failed to load marketplace.
          </div>
        )}
        {flowsQuery.isSuccess && filtered.length === 0 && (
          <div
            style={{
              color: "var(--text-secondary)",
              padding: "1rem",
            }}
          >
            {filter
              ? "No flows match."
              : "No public flows yet — be the first to publish!"}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(18rem, 1fr))",
            gap: "0.75rem",
          }}
        >
          {filtered.map((flow) => (
            <MarketplaceCard
              key={flow.id}
              flow={flow}
              selected={selectedSet.has(flow.id)}
              inMultiSelect={selectedSet.has(flow.id)}
              onUse={() => onUseSingle(flow.id)}
              onCopy={() => onCopyFlow(flow)}
              onToggleSelect={() =>
                onToggleMultiSelect(flow.id)
              }
              onVote={(v) =>
                vote.mutate({ id: flow.id, vote: v })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const pillBase: React.CSSProperties = {
  padding: "5px 12px",
  fontFamily: "var(--font-sans)",
  fontSize: "0.75rem",
  fontWeight: 500,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-full)",
};

const pillPrimary: React.CSSProperties = {
  ...pillBase,
  backgroundColor: "var(--accent)",
  color: "#fff",
  borderColor: "var(--accent)",
  cursor: "pointer",
};

const pillSecondary: React.CSSProperties = {
  ...pillBase,
  backgroundColor: "var(--bg-input)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
