// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { captchaHeaders } from "../lib/captcha";

export interface ModelInfo {
  id: string;
  label: string;
}

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await fetch("/api/models");
      if (!res.ok)
        throw new Error("failed to fetch models");
      return res.json() as Promise<ModelInfo[]>;
    },
    staleTime: Infinity,
  });
}

export function usePreferredModel(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["preferred-model"],
    queryFn: async () => {
      const res = await fetch("/api/preferred-model");
      if (!res.ok) return null;
      const data = (await res.json()) as {
        model: string;
      };
      return data.model;
    },
    staleTime: Infinity,
    enabled: opts?.enabled ?? true,
  });
}

export function useSavePreferredModel() {
  return useMutation({
    mutationFn: async (model: string) => {
      await fetch("/api/preferred-model", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await captchaHeaders()),
        },
        body: JSON.stringify({ model }),
      });
    },
  });
}
