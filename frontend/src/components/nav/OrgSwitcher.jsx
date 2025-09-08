import React, { useMemo, useState } from "react";
import { useOrg } from "../../contexts/OrgContext";

export default function OrgSwitcher({ compact = false }) {
  const { orgs, selected, setSelected, canSeeSelector } = useOrg();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orgs;
    return orgs.filter((o) =>
      o.name.toLowerCase().includes(term) || o.slug?.toLowerCase().includes(term)
    );
  }, [q, orgs]);

  if (!canSeeSelector) {
    if (orgs.length === 1) {
      return <div className="text-sm text-gray-600 px-2 py-1 rounded">{orgs[0]?.name}</div>;
    }
    return null;
  }

  return (
    <div className={`w-full ${compact ? "" : "mb-3"}`} data-testid="org-switcher">
      <label className="text-xs text-gray-500 block mb-1">Organização</label>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar organização…"
        className="w-full border rounded px-2 py-1 text-sm mb-1"
      />
      <ul className="max-h-52 overflow-auto border rounded">
        {filtered.map((org) => (
          <li key={org.id}>
            <button
              type="button"
              className={`w-full text-left px-2 py-1 rounded ${
                selected === org.id ? "bg-blue-50 font-medium" : "hover:bg-gray-50"
              }`}
              onClick={() => setSelected(org.id)}
            >
              {org.name}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li>
            <div className="px-2 py-2 text-sm text-gray-500">Nenhuma organização</div>
          </li>
        )}
      </ul>
    </div>
  );
}

