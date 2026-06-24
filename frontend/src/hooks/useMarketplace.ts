// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { FlowDefinition } from "./useFlows";

export interface MarketplaceFlow {
  id: string;
  name: string;
  description: string | null;
  definition: FlowDefinition;
  author_id: string;
  author_display_name: string;
  public_parent_id: string | null;
  updated_at: string;
  up_count: number;
  down_count: number;
  current_user_vote: number;
}

export interface MarketplaceFlowDetail {
  id: string;
  name: string;
  description: string | null;
  definition: FlowDefinition;
  author_id: string;
  author_display_name: string;
  public_parent_id: string | null;
  updated_at: string;
}

export type MarketplaceSort = "top" | "new" | "hot";

export function useMarketplaceFlows(
  sort: MarketplaceSort = "top",
  opts?: { enabled?: boolean },
) {
  return useQuery<MarketplaceFlow[]>({
    queryKey: ["marketplace", sort],
    queryFn: async () => {
      const res = await fetch(
        `/api/marketplace/flows?sort=${sort}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch marketplace");
      }
      return res.json();
    },
    staleTime: 30_000,
    enabled: opts?.enabled ?? true,
  });
}

export function useMarketplaceSearch(query: string) {
  return useQuery<MarketplaceFlow[]>({
    queryKey: ["marketplace-search", query],
    queryFn: async () => {
      const res = await fetch(
        `/api/marketplace/search?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) {
        throw new Error("Search failed");
      }
      return res.json();
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useMarketplaceFlow(
  id: string | null,
  opts?: { enabled?: boolean },
) {
  return useQuery<MarketplaceFlowDetail>({
    queryKey: ["marketplace", id],
    queryFn: async () => {
      const res = await fetch(
        `/api/marketplace/flows/${id}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch flow");
      }
      return res.json();
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useVoteFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      vote: -1 | 0 | 1;
    }) => {
      const res = await fetch(
        `/api/marketplace/flows/${args.id}/vote`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vote: args.vote }),
        },
      );
      if (!res.ok) throw new Error("Vote failed");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["marketplace"],
      });
    },
  });
}

