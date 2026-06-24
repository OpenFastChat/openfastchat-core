// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  delay?: number;
  placement?: "top" | "bottom";
  wrapperStyle?: CSSProperties;
  maxWidth?: number;
}

export function Tooltip({
  text,
  children,
  delay = 400,
  placement = "bottom",
  wrapperStyle,
  maxWidth = 240,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const show = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(
      () => setOpen(true),
      delay,
    );
  };

  const hide = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return (
    <div
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{
        position: "relative",
        display: "inline-block",
        ...wrapperStyle,
      }}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            ...(placement === "bottom"
              ? { top: "calc(100% + 6px)" }
              : { bottom: "calc(100% + 6px)" }),
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--bg-input)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "6px 10px",
            fontSize: "0.75rem",
            lineHeight: 1.4,
            maxWidth,
            width: "max-content",
            whiteSpace: "normal",
            boxShadow:
              "0 4px 16px rgba(0, 0, 0, 0.35)",
            zIndex: 1000,
            pointerEvents: "none",
            opacity: 0,
            animation:
              "tooltipFadeIn 100ms ease-out forwards",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
