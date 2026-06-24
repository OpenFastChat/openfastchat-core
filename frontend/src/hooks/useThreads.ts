// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError } from "../lib/apiFetch";
import { captchaHeaders } from "../lib/captcha";
import { showErrorNotice } from "../lib/notice";

export interface Thread {
  id: string;
  title: string;
  updated_at: string;
  scroll_top_fraction: number | null;
}

export function useUpdateThreadScroll() {
  return useMutation({
    mutationFn: async ({
      id,
      fraction,
    }: {
      id: string;
      fraction: number | null;
    }) => {
      await fetch(`/api/threads/${id}/scroll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fraction }),
      });
    },
  });
}

export function useThreads(opts?: { enabled?: boolean }) {
  return useQuery<Thread[]>({
    queryKey: ["threads"],
    queryFn: async () => {
      const res = await fetch("/api/threads");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: opts?.enabled ?? true,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Thread> => {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: await captchaHeaders(),
      });
      if (!res.ok) {
        throw new ApiError(res.status, await res.text());
      }
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Thread[]>(["threads"], (prev) =>
        prev ? [created, ...prev] : [created],
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["threads"],
      });
      // First write on an anonymous session auto-provisions
      // a guest user server-side — refetch /api/me so the
      // frontend stops treating the visitor as anonymous.
      void queryClient.invalidateQueries({
        queryKey: ["me"],
      });
    },
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/threads/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["threads"],
      });
    },
  });
}

export function useRenameThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
    }: {
      id: string;
      title: string;
    }) => {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        throw new ApiError(res.status, await res.text());
      }
    },
    onError: (e) => {
      showErrorNotice(e, {
        kind: "thread_rename_failed",
        fallback: "Could not rename this chat.",
        httpMethod: "PATCH",
        httpPath: "/api/threads/:id",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["threads"],
      });
    },
  });
}
