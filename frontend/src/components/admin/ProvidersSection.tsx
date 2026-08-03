// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";

interface Provider {
  id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  has_key: boolean;
  key_last4: string;
}

interface Draft {
  name: string;
  base_url: string;
  api_key: string;
  enabled: boolean;
}

const emptyDraft: Draft = {
  name: "",
  base_url: "",
  api_key: "",
  enabled: true,
};

const heading: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.8rem",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "2rem 0 0.75rem",
};

const input: React.CSSProperties = {
  backgroundColor: "var(--bg-input)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "6px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: "0.85rem",
  outline: "none",
};

const button: React.CSSProperties = {
  backgroundColor: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "6px 16px",
  fontSize: "0.85rem",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

/**
 * Admin panel to manage the OpenAI-compatible LLM providers stored
 * (keys encrypted) in the database. Shared by every wrapper's admin
 * surface; talks only to /api/admin/providers, so the wrapper decides
 * how that route is gated.
 */
export function ProvidersSection() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setError("Failed to load providers"));
  };

  useEffect(load, []);

  const reset = () => {
    setDraft(emptyDraft);
    setEditId(null);
  };

  const submit = async () => {
    setError("");
    const url = editId
      ? `/api/admin/providers/${editId}`
      : "/api/admin/providers";
    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setError((await res.text()) || "Save failed");
      return;
    }
    reset();
    load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/providers/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (editId === id) reset();
      load();
    }
  };

  const startEdit = (p: Provider) => {
    setEditId(p.id);
    setDraft({
      name: p.name,
      base_url: p.base_url,
      api_key: "",
      enabled: p.enabled,
    });
  };

  return (
    <div>
      <h2 style={heading}>LLM Providers</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          margin: "0 0 0.75rem",
        }}
      >
        OpenAI-compatible endpoints (Groq, DeepSeek, a local
        vLLM/Ollama server, …). Keys are encrypted at rest and never
        shown again — leave the key blank when editing to keep it.
      </p>

      {error && (
        <div
          style={{
            color: "var(--accent-error)",
            fontSize: "0.85rem",
            marginBottom: "0.75rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        {providers.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              opacity: p.enabled ? 1 : 0.5,
            }}
          >
            <span
              style={{
                color: "var(--text)",
                fontSize: "0.85rem",
                fontWeight: 600,
                minWidth: "90px",
              }}
            >
              {p.name}
            </span>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.8rem",
                fontFamily: "var(--font-mono)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.base_url}
            </span>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.8rem",
                fontFamily: "var(--font-mono)",
              }}
            >
              {p.has_key ? `••••${p.key_last4}` : "no key"}
            </span>
            <button
              onClick={() => startEdit(p)}
              style={{
                ...button,
                backgroundColor: "transparent",
                color: "var(--accent-text)",
                padding: "4px 8px",
              }}
            >
              Edit
            </button>
            <button
              onClick={() => remove(p.id)}
              style={{
                ...button,
                backgroundColor: "transparent",
                color: "var(--accent-error)",
                padding: "4px 8px",
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          padding: "12px",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <input
          placeholder="name (e.g. deepseek)"
          value={draft.name}
          disabled={editId !== null}
          onChange={(e) =>
            setDraft({ ...draft, name: e.target.value })
          }
          style={{ ...input, width: "140px" }}
        />
        <input
          placeholder="https://api.deepseek.com/v1"
          value={draft.base_url}
          onChange={(e) =>
            setDraft({ ...draft, base_url: e.target.value })
          }
          style={{ ...input, flex: 1, minWidth: "200px" }}
        />
        <input
          type="password"
          placeholder={
            editId ? "key (unchanged)" : "api key (optional)"
          }
          value={draft.api_key}
          onChange={(e) =>
            setDraft({ ...draft, api_key: e.target.value })
          }
          style={{ ...input, width: "180px" }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            color: "var(--text)",
            fontSize: "0.8rem",
          }}
        >
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) =>
              setDraft({ ...draft, enabled: e.target.checked })
            }
          />
          enabled
        </label>
        <button onClick={submit} style={button}>
          {editId ? "Save" : "Add"}
        </button>
        {editId && (
          <button
            onClick={reset}
            style={{
              ...button,
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
