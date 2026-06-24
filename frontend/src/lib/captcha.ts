// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

type TokenProvider = () => Promise<string>;

let provider: TokenProvider | null = null;
let anonymous = true;

export function registerCaptchaProvider(p: TokenProvider | null) {
  provider = p;
}

export function setCaptchaAnonymous(value: boolean) {
  anonymous = value;
}

// Header an anonymous session must send so the backend's
// EnsureUser middleware provisions a guest on the first write.
// Empty once provisioned (the session cookie takes over) or
// when Turnstile isn't configured. Rejects if the visitor
// dismisses the interactive challenge.
export async function captchaHeaders(): Promise<Record<string, string>> {
  if (!anonymous || !provider) return {};
  return { "X-Turnstile-Token": await provider() };
}
