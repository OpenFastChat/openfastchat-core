// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { errorStatus, errorMessage, isNetworkError } from "./apiFetch";

export type NoticeVariant = "error" | "contact";

export interface Notice {
  kind: string;
  message: string;
  statusCode?: number;
  httpMethod?: string;
  httpPath?: string;
  context?: Record<string, unknown>;
  variant?: NoticeVariant;
  canReport?: boolean;
}

type Listener = (err: Notice) => void;

const listeners = new Set<Listener>();

export function showNotice(err: Notice) {
  for (const l of listeners) l(err);
}

interface ErrorNoticeOptions {
  kind: string;
  fallback: string;
  httpMethod?: string;
  httpPath?: string;
  canReport?: boolean;
}

// Only unexpected server faults are worth offering to report. Network
// failures (the report would fail too), throttling, and client errors
// are expected conditions; non-HTTP JS errors are real bugs.
function defaultCanReport(error: unknown): boolean {
  if (isNetworkError(error)) return false;
  const status = errorStatus(error);
  if (status === 0) return true;
  return status >= 500 && status !== 503;
}

// Build a notice from a caught error: shows the server's parsed
// message (not the raw JSON body) and a sane reportable default.
export function showErrorNotice(
  error: unknown,
  opts: ErrorNoticeOptions,
) {
  const status = errorStatus(error);
  showNotice({
    kind: opts.kind,
    message: errorMessage(error, opts.fallback),
    statusCode: status || undefined,
    httpMethod: opts.httpMethod,
    httpPath: opts.httpPath,
    canReport: opts.canReport ?? defaultCanReport(error),
  });
}

export function subscribeNotice(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export async function sendIssueReport(
  err: Notice,
  userComment: string,
): Promise<void> {
  const payload = {
    kind: err.kind,
    message: err.message,
    status_code: err.statusCode ?? 0,
    http_method: err.httpMethod ?? "",
    http_path: err.httpPath ?? "",
    user_comment: userComment,
    context: {
      url: window.location.href,
      user_agent: navigator.userAgent,
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
      },
      timestamp: new Date().toISOString(),
      ...(err.context ?? {}),
    },
  };
  await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}
