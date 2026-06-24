// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { captchaHeaders } from "../lib/captcha";

export interface FlowInfo {
  id: string;
  name: string;
  display_name: string;
  is_featured: boolean;
  editable: boolean;
  is_published: boolean;
  has_unpublished_changes: boolean;
  description: string | null;
  definition: FlowDefinition;
  public_parent_id: string | null;
  created_at: string;
  updated_at: string;
  duplicate_published_flow_name: string | null;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function useFlows(opts?: { enabled?: boolean }) {
  return useQuery<FlowInfo[]>({
    queryKey: ["flows"],
    queryFn: async () => {
      const res = await fetch("/api/flows");
      if (!res.ok)
        throw new Error("Failed to fetch flows");
      return res.json();
    },
    staleTime: 30_000,
    enabled: opts?.enabled ?? true,
  });
}

export function useFlow(id: string | null) {
  return useQuery<FlowInfo>({
    queryKey: ["flows", id],
    queryFn: async () => {
      const res = await fetch(`/api/flows/${id}`);
      if (!res.ok)
        throw new Error("Failed to fetch flow");
      return res.json();
    },
    enabled: !!id,
  });
}

export class FlowApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      name: string;
      definition: FlowDefinition;
      description?: string | null;
    }) => {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await captchaHeaders()),
        },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        throw new FlowApiError(
          res.status, await res.text(),
        );
      }
      return res.json() as Promise<FlowInfo>;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<FlowInfo[]>(["flows"], (prev) =>
        prev ? [created, ...prev] : [created],
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      name: string;
      definition: FlowDefinition;
      description?: string | null;
    }) => {
      const body: Record<string, unknown> = {
        name: args.name,
        definition: args.definition,
      };
      if (args.description !== undefined) {
        body.description = args.description;
      }
      const res = await fetch(`/api/flows/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new FlowApiError(
          res.status, await res.text(),
        );
      }
    },
    onSuccess: (_data, args) => {
      queryClient.setQueryData<FlowInfo[]>(["flows"], (prev) =>
        prev?.map((f) =>
          f.id === args.id
            ? {
                ...f,
                name: args.name,
                definition: args.definition,
                description:
                  args.description !== undefined
                    ? args.description
                    : f.description,
              }
            : f,
        ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/flows/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
    },
  });
}

export function useActivateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/flows/${id}/activate`,
        { method: "PUT" },
      );
      if (!res.ok) throw new Error("Activate failed");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["me"],
      });
    },
  });
}

export function usePublishFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/flows/${id}/publish`,
        { method: "POST" },
      );
      if (!res.ok) {
        throw new FlowApiError(
          res.status, await res.text(),
        );
      }
      return res.json() as Promise<FlowInfo>;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["marketplace"],
      });
    },
  });
}

export function useUnpublishFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/flows/${id}/publish`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new FlowApiError(
          res.status, await res.text(),
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["marketplace"],
      });
    },
  });
}
