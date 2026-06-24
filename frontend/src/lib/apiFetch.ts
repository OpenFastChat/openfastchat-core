// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { captchaHeaders } from "./captcha";

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body || "request failed"}`);
    this.status = status;
    this.body = body;
  }
}

export function errorStatus(error: unknown): number {
  const s = (error as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : 0;
}

/** A fetch() that never reaches the server rejects with a TypeError
 *  (the message wording differs per browser). These aren't worth
 *  offering to report — the report request would fail the same way. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

function errorBody(error: unknown): string {
  return error instanceof ApiError
    ? error.body
    : error instanceof Error
      ? error.message
      : "";
}

export function errorMessage(error: unknown, fallback: string): string {
  const raw = errorBody(error);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    void 0;
  }
  return raw || fallback;
}

export function errorCode(error: unknown): string {
  try {
    const parsed = JSON.parse(errorBody(error));
    if (parsed && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    void 0;
  }
  return "";
}

export interface ApiFetchOptions extends RequestInit {
  json?: unknown;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options;
  const method = rest.method ?? (json !== undefined ? "POST" : "GET");
  const captcha =
    method.toUpperCase() === "GET" ? {} : await captchaHeaders();
  const baseHeaders = { ...(headers ?? {}), ...captcha };
  const init: RequestInit = {
    credentials: "include",
    ...rest,
    headers: baseHeaders,
  };
  if (json !== undefined) {
    init.method = init.method ?? "POST";
    init.headers = {
      "Content-Type": "application/json",
      ...baseHeaders,
    };
    init.body = JSON.stringify(json);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
