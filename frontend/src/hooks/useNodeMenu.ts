// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { ALL_NODE_TYPES } from "../components/flow/nodes/nodeCatalog";

const QUERY_KEY = ["node-menu"];

export function useNodeMenu(opts?: { enabled?: boolean }) {
  return useQuery<string[]>({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<string[]>("/api/node-menu"),
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
  });
}

// A stored menu of zero types means "show every node". The first
// add/remove materialises the explicit list from this default.
export function effectiveMenu(stored: string[] | undefined): string[] {
  if (!stored || stored.length === 0) return ALL_NODE_TYPES;
  return stored.filter((t) => ALL_NODE_TYPES.includes(t));
}

export function useUpdateNodeMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menu: string[]) =>
      apiFetch("/api/node-menu", { method: "PUT", json: menu }),
    onMutate: async (menu) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<string[]>(QUERY_KEY);
      queryClient.setQueryData<string[]>(QUERY_KEY, menu);
      return { previous };
    },
    onError: (_err, _menu, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
