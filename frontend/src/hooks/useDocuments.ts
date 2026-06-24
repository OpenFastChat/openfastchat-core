// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { captchaHeaders } from "../lib/captcha";
import { showNotice } from "../lib/notice";

export interface DocumentInfo {
  id: string;
  filename: string;
  file_size: number;
  status: string;
  error?: string;
  created_at: string;
}

export function useDocuments(opts?: { enabled?: boolean }) {
  return useQuery<DocumentInfo[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents");
      if (!res.ok)
        throw new Error("Failed to fetch documents");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: opts?.enabled ?? true,
  });
}

export function useUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      let headers: Record<string, string>;
      try {
        headers = await captchaHeaders();
      } catch {
        throw new Error("Captcha failed — please try again.");
      }
      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ?? body.message ?? "Upload failed",
        );
      }
      return res.json() as Promise<DocumentInfo>;
    },
    onMutate: async (file) => {
      await queryClient.cancelQueries({
        queryKey: ["documents"],
      });
      const previous =
        queryClient.getQueryData<DocumentInfo[]>(
          ["documents"],
        );
      const optimistic: DocumentInfo = {
        id: "pending-" + Date.now(),
        filename: file.name,
        file_size: file.size,
        status: "uploading",
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<DocumentInfo[]>(
        ["documents"],
        (old) => [optimistic, ...(old ?? [])],
      );
      return { previous };
    },
    onError: (err, _file, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["documents"], context.previous,
        );
      }
      showNotice({
        kind: "upload_failed",
        message:
          err instanceof Error
            ? err.message
            : "Upload failed",
        httpMethod: "POST",
        httpPath: "/api/upload",
        canReport: false,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents"],
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ["documents"],
      });
      const previous =
        queryClient.getQueryData<DocumentInfo[]>(
          ["documents"],
        );
      queryClient.setQueryData<DocumentInfo[]>(
        ["documents"],
        (old) => old?.filter((d) => d.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["documents"], context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents"],
      });
    },
  });
}
