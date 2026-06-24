// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type TextareaHTMLAttributes,
  type ChangeEvent,
} from "react";

interface Props
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number;
}

export const AutoTextarea = forwardRef<
  HTMLTextAreaElement, Props
>(function AutoTextarea(
  {
    maxHeight = 400,
    style,
    value,
    onChange,
    ...rest
  },
  forwardedRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(
    forwardedRef,
    () => ref.current as HTMLTextAreaElement,
    [],
  );

  const initial = typeof value === "string" ? value : "";
  const [local, setLocal] = useState(initial);

  useEffect(() => {
    if (typeof value !== "string") return;
    setLocal((prev) => (prev === value ? prev : value));
  }, [value]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height =
      Math.min(el.scrollHeight, maxHeight) + "px";
  };

  useEffect(resize, [local, maxHeight]);

  const handleChange = (
    e: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setLocal(e.target.value);
    onChange?.(e);
  };

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={handleChange}
      className="nodrag nopan nowheel"
      style={{
        resize: "none",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    />
  );
});
