import React, { useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../../services/session.js";

function normalizeList(list = []) {
  return list
    .map((item) => String(item ?? "").trim())
    .map((item) => item.replace(/\s+/g, " "))
    .filter(Boolean);
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = Number(str);
  if (Number.isNaN(num)) return null;
  return num;
}

export default function CalendarPermissionsEditor({ calendars = [], onSaved }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of calendars) {
      const key = c?.name || "(sem nome)";
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          items: [],
          aliases: Array.isArray(c?.aliases) ? [...c.aliases] : [],
          skills: Array.isArray(c?.skills) ? [...c.skills] : [],
          slotMin: c?.slotMin ?? "",
          buffers: {
            pre: c?.buffers?.pre ?? "",
            post: c?.buffers?.post ?? "",
          },
        });
      }
      map.get(key)?.items.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [calendars]);

  const [draft, setDraft] = useState(groups);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setDraft(groups);
  }, [groups]);

  function setField(idx, field, val) {
    setDraft((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  }

  async function saveOne(group) {
    const body = {
      aliases: normalizeList(group.aliases),
      skills: normalizeList(group.skills),
      slotMin: normalizeNumber(group.slotMin),
      buffers: {
        pre: normalizeNumber(group.buffers?.pre),
        post: normalizeNumber(group.buffers?.post),
      },
    };

    const response = await authFetch(
      `/api/calendar/calendars/${encodeURIComponent(group.name)}/permissions`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  async function handleSave(idx) {
    try {
      await saveOne(draft[idx]);
      await onSaved?.();
      // eslint-disable-next-line no-alert
      alert("Permissões atualizadas!");
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(`Falha ao salvar: ${error?.message ?? ""}`);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {draft.map((group, idx) => (
        <div
          key={group.name}
          style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{group.name}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>
              Aliases (separados por vírgula)
              <input
                value={Array.isArray(group.aliases) ? group.aliases.join(", ") : ""}
                onChange={(event) =>
                  setField(
                    idx,
                    "aliases",
                    event.target.value.split(",").map((item) => item.trim()),
                  )
                }
                placeholder="ex.: dr rodrigo, rod, ro"
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label>
              Skills (separadas por vírgula)
              <input
                value={Array.isArray(group.skills) ? group.skills.join(", ") : ""}
                onChange={(event) =>
                  setField(
                    idx,
                    "skills",
                    event.target.value.split(",").map((item) => item.trim()),
                  )
                }
                placeholder="ex.: consulta, avaliacao"
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}
          >
            <label>
              Slot padrão (min)
              <input
                type="number"
                min="10"
                step="5"
                value={group.slotMin ?? ""}
                onChange={(event) => setField(idx, "slotMin", event.target.value)}
                placeholder="ex.: 30"
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label>
              Buffer pré (min)
              <input
                type="number"
                min="0"
                step="5"
                value={group.buffers?.pre ?? ""}
                onChange={(event) =>
                  setField(idx, "buffers", {
                    ...group.buffers,
                    pre: event.target.value,
                  })
                }
                placeholder="ex.: 10"
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label>
              Buffer pós (min)
              <input
                type="number"
                min="0"
                step="5"
                value={group.buffers?.post ?? ""}
                onChange={(event) =>
                  setField(idx, "buffers", {
                    ...group.buffers,
                    post: event.target.value,
                  })
                }
                placeholder="ex.: 10"
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              onClick={() => handleSave(idx)}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      ))}
      {draft.length === 0 && <div style={{ opacity: 0.7 }}>Nenhum profissional carregado.</div>}
    </div>
  );
}
