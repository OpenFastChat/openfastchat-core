// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export function flowShareUrl(flowId: string): string {
  return `${window.location.origin}/flow/${flowId}`;
}

export async function copyShareLink(
  flowId: string,
): Promise<boolean> {
  const url = flowShareUrl(flowId);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
