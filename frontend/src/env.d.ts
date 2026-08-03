// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

// Ambient declarations for the bundler-specific imports the UI uses, so the
// package typechecks standalone (the consuming wrapper's Vite provides the
// real implementations).
declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.css";
