// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState } from "react";

export type Panel = "flows" | "marketplace" | "nodes" | "none";

function readStoredPanel(): Panel {
  const stored = localStorage.getItem("activePanel");
  if (
    stored === "flows" ||
    stored === "marketplace" ||
    stored === "nodes" ||
    stored === "none"
  ) {
    return stored;
  }
  return "none";
}

export function usePanelState() {
  const [panel, setPanelState] = useState<Panel>(readStoredPanel);

  const setPanel = useCallback((next: Panel) => {
    localStorage.setItem("activePanel", next);
    setPanelState(next);
  }, []);

  const toggle = useCallback(
    (target: Exclude<Panel, "none">) =>
      setPanel(panel === target ? "none" : target),
    [panel, setPanel],
  );

  return {
    panel,
    setPanel,
    toggle,
    showFlowEditor: panel === "flows",
    showMarketplace: panel === "marketplace",
    showNodes: panel === "nodes",
  };
}
