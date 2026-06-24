// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  loadActiveFlow,
  saveActiveFlow,
  type ActiveFlow,
} from "../lib/activeFlow";
import type { FlowInfo } from "./useFlows";

interface UseActiveFlowOptions {
  flows: FlowInfo[];
  flowsReady: boolean;
  defaultFlowId: string | null;
  onDeepLink?: () => void;
}

export function useActiveFlow({
  flows,
  flowsReady,
  defaultFlowId,
  onDeepLink,
}: UseActiveFlowOptions) {
  const routeParams = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const deepLinkedRef = useRef<string | null>(null);
  const [activeFlow, setActiveFlowState] = useState<ActiveFlow | null>(
    () => loadActiveFlow(),
  );
  const [marketplaceSelection, setMarketplaceSelectionState] = useState<
    string[]
  >(() => readSelection());

  useEffect(() => {
    try {
      localStorage.setItem(
        "marketplaceSelection",
        JSON.stringify(marketplaceSelection),
      );
    } catch {
      // ignore
    }
  }, [marketplaceSelection]);

  const setActiveFlow = useCallback((next: ActiveFlow) => {
    setActiveFlowState(next);
    saveActiveFlow(next);
  }, []);

  const setActiveUserFlow = useCallback(
    (id: string) => setActiveFlow({ kind: "user", id }),
    [setActiveFlow],
  );

  // Deep-link sync: /flow/:id → set as active. Works for
  // anonymous visitors too; the editor renders marketplace
  // flows read-only until the user signs in to fork them.
  useEffect(() => {
    const id = routeParams.id;
    if (!id) return;
    if (deepLinkedRef.current === id) return;
    if (!flowsReady) return;
    deepLinkedRef.current = id;
    const own = flows.some((f) => f.id === id);
    setActiveFlow(
      own
        ? { kind: "user", id }
        : { kind: "marketplace_single", id },
    );
    onDeepLink?.();
    navigate("/", { replace: true });
  }, [
    routeParams.id,
    flowsReady,
    flows,
    setActiveFlow,
    onDeepLink,
    navigate,
  ]);

  // Initial selection when no valid active flow exists.
  useEffect(() => {
    if (!flowsReady || flows.length === 0) return;
    if (
      activeFlow?.kind === "user" &&
      flows.some((f) => f.id === activeFlow.id)
    ) {
      return;
    }
    if (
      activeFlow?.kind === "marketplace_single" ||
      activeFlow?.kind === "marketplace_multi"
    ) {
      return;
    }
    const userDefault = defaultFlowId
      ? flows.find((f) => f.id === defaultFlowId)
      : null;
    const myLatest = flows.find((f) => f.editable);
    const featuredDefault = flows.find((f) => !f.editable);
    const initial =
      userDefault ?? myLatest ?? featuredDefault ?? flows[0];
    setActiveUserFlow(initial.id);
  }, [activeFlow, flowsReady, flows, defaultFlowId, setActiveUserFlow]);

  const ids = useMemo(() => {
    return {
      userFlowId:
        activeFlow?.kind === "user" ? activeFlow.id : "",
      marketplaceSingleId:
        activeFlow?.kind === "marketplace_single"
          ? activeFlow.id
          : null,
      marketplaceMultiIds:
        activeFlow?.kind === "marketplace_multi"
          ? activeFlow.ids
          : [],
    };
  }, [activeFlow]);

  return {
    activeFlow,
    setActiveFlow,
    setActiveUserFlow,
    marketplaceSelection,
    setMarketplaceSelection: setMarketplaceSelectionState,
    ...ids,
  };
}

function readSelection(): string[] {
  const raw = localStorage.getItem("marketplaceSelection");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
