// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { AutoTextarea } from "../../AutoTextarea";
import { BaseNode, type OutputHandleSpec } from "./BaseNode";
import { nodeInputClass, nodeInputStyle } from "./styles";
import { useNodeData, type NodeDataChange } from "./useNodeData";

interface Answer {
  id: string;
  label: string;
}

interface Props {
  id: string;
  selected?: boolean;
  data: {
    question?: string;
    answers?: Answer[];
    model?: string;
    max_iterations?: number;
    show_output?: boolean;
    models?: Array<{ id: string; label: string }>;
    isActive?: boolean;
    isCompleted?: boolean;
    isError?: boolean;
    isSkipped?: boolean;
    onDataChange?: NodeDataChange;
  };
}

const MAX_ITER_CAP = 10;
const HANDLE_COLORS = [
  "var(--accent-success)",
  "var(--accent)",
  "var(--accent-warning)",
  "var(--accent-error)",
  "var(--text-secondary)",
];

const DEFAULT_ANSWERS: Answer[] = [
  { id: "yes", label: "yes" },
  { id: "no", label: "no" },
];

function clampIterations(raw: string): number {
  let v = parseInt(raw, 10);
  if (isNaN(v) || v < 1) v = 1;
  if (v > MAX_ITER_CAP) v = MAX_ITER_CAP;
  return v;
}

function nextAnswerId(answers: Answer[]): string {
  let max = 0;
  for (const a of answers) {
    const m = /^a(\d+)$/.exec(a.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `a${max + 1}`;
}

export function QuestionNode({ id, selected, data }: Props) {
  const patch = useNodeData(id, data.onDataChange);
  const models = data.models ?? [];
  const answers =
    data.answers && data.answers.length > 0
      ? data.answers
      : DEFAULT_ANSWERS;
  const [iterText, setIterText] = useState(
    String(data.max_iterations ?? MAX_ITER_CAP),
  );

  useEffect(() => {
    setIterText(String(data.max_iterations ?? MAX_ITER_CAP));
  }, [data.max_iterations]);

  const setLabel = (idx: number, label: string) => {
    const next = answers.map((a, i) => (i === idx ? { ...a, label } : a));
    patch({ answers: next });
  };
  const addAnswer = () =>
    patch({
      answers: [...answers, { id: nextAnswerId(answers), label: "" }],
    });
  const removeAnswer = (idx: number) =>
    patch({ answers: answers.filter((_, i) => i !== idx) });

  const handles: OutputHandleSpec[] = answers.map((a, i) => ({
    id: a.id,
    color: HANDLE_COLORS[i % HANDLE_COLORS.length],
    label: a.label || a.id,
    style: { top: `${((i + 1) / (answers.length + 1)) * 100}%` },
  }));

  return (
    <BaseNode
      label="Question"
      icon="&#x3F;"
      nodeType="question"
      hasInput
      selected={selected}
      isActive={data.isActive}
      isCompleted={data.isCompleted}
      isError={data.isError}
      isSkipped={data.isSkipped}
      showOutput={data.show_output}
      onToggleShowOutput={() => patch({ show_output: !data.show_output })}
      minWidth="190px"
      maxWidth="260px"
      outputHandles={handles}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          paddingRight: "44px",
        }}
      >
        <AutoTextarea
          value={data.question ?? ""}
          onChange={(e) => patch({ question: e.target.value })}
          placeholder="Question about input?"
          rows={2}
          maxHeight={240}
          style={{ ...nodeInputStyle, fontFamily: "inherit" }}
        />
        {answers.map((a, i) => (
          <div
            key={a.id}
            style={{ display: "flex", gap: "4px", alignItems: "center" }}
          >
            <input
              value={a.label}
              onChange={(e) => setLabel(i, e.target.value)}
              placeholder={`answer ${i + 1}`}
              className={nodeInputClass}
              style={{ ...nodeInputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeAnswer(i)}
              disabled={answers.length <= 2}
              style={{
                border: "none",
                background: "transparent",
                cursor: answers.length <= 2 ? "default" : "pointer",
                color: "var(--text-secondary)",
                opacity: answers.length <= 2 ? 0.3 : 1,
                padding: "0 2px",
              }}
              title="remove answer"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAnswer}
          style={{
            border: "1px dashed var(--border)",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: "0.75em",
            padding: "2px",
            borderRadius: "4px",
          }}
        >
          + answer
        </button>
        <select
          value={data.model ?? ""}
          onChange={(e) => patch({ model: e.target.value })}
          className={nodeInputClass}
          style={nodeInputStyle}
        >
          <option value="">default</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span>max loops:</span>
          <input
            type="number"
            min={1}
            max={MAX_ITER_CAP}
            step={1}
            value={iterText}
            onChange={(e) => {
              const raw = e.target.value;
              setIterText(raw);
              if (raw === "") return;
              const v = parseInt(raw, 10);
              if (!isNaN(v) && v >= 1 && v <= MAX_ITER_CAP) {
                patch({ max_iterations: v });
              }
            }}
            onBlur={() => {
              const v = clampIterations(iterText);
              setIterText(String(v));
              patch({ max_iterations: v });
            }}
            className={nodeInputClass}
            style={{ ...nodeInputStyle, width: "50px" }}
          />
        </div>
      </div>
    </BaseNode>
  );
}
