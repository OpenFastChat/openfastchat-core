// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export const WELCOME_THREAD_ID = "__welcome";

export function isWelcomeThread(id: string | null | undefined): boolean {
  return !id || id === WELCOME_THREAD_ID;
}
