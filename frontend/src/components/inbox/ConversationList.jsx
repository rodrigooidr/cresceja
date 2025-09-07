import { useEffect, useMemo, useState } from "react";
import inboxApi from "../../api/inboxApi.js";

function ChannelIcon({ kind }) {
  const map = { whatsapp: "🟢", instagram: "📸", facebook: "📘" };
  return <span className="text-lg" title={kind || "canal"}>{map[kind] || "💭"}</span>;
}

// Constrói URL absoluta baseada no baseURL do inboxApi (que já inclui /api)
function assetUrl(relative) {
  const base = String(inboxApi?.defaults?.baseURL || "").replace(/\/+$/, "");
  const rel = String(relative || "").replace(/^\/+/, "");
  return `${base}/${rel}`;
}

export default function ConversationList({ onSelect, selectedId }) {
  const [convs, setConvs] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    channel: "",
    tag: "",
  });

  // Debounce de 300ms para busca
  const debouncedQ = useDebouncedValue(filters.q, 300);

  // Carrega conversas quando filtros mudarem
  useEffect(() => {
    const params = {
      // mapeia para os nomes esperados pelo backend
      search: debouncedQ || undefined,
      channels: filters.channel || undefined,
      status: filters.status || undefined,
      tags: filters.tag || undefined,
      limit: 30,
    };

    let canceled = false;
    inboxApi
      .get("/conversations", { params })
      .then((r) => {
        if (canceled) return;
        const items = Array.isArray(r?.data?.items)
          ? r.data.items
          : Array.isArray(r?.data)
          ? r.data
          : r?.data?.data || [];
        setConvs(items || []);
      })
      .catch(() => {
        if (!canceled) setConvs([]);
      });

    return () => {
      canceled = true;
    };
  }, [debouncedQ, filters.channel, filters.status, filters.tag]);

  // UI de filtro por canal
  const ChannelFilter = (
    <div className="flex gap-2">
      {[
        { key: "", label: "Todos" },
        { key: "whatsapp", label: "WhatsApp" },
        { key: "instagram", label: "Instagram" },
        { key: "facebook", label: "Facebook" },
      ].map((opt) => (
        <button
          key={opt.key || "all"}
          onClick={() => setFilters((f) => ({ ...f, channel: opt.key }))}
          className={`px-2 py-1 rounded text-sm border ${
            (filters.channel || "") === (opt.key || "")
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 space-y-2">
        <input
          placeholder="Buscar"
          className="w-full border p-2 rounded"
          value={filters.q}
          onChange={(e) =>
            setFilters((f) => ({ ...f, q: e.target.value || "" }))
          }
        />
        {ChannelFilter}
      </div>

        <ul className="flex-1 overflow-y-auto" data-testid="conv-list">
        {(convs || []).map((c) => {
          const photo =
            c.photo_asset_id ? assetUrl(`assets/${c.photo_asset_id}`) : null;
          const isSel = String(selectedId) === String(c.id);
          const title =
            c.name ||
            c.contact_name ||
            c.display_name ||
            c?.contact?.name ||
            c.phone ||
            "";
          return (
            <li
              key={c.id}
              onClick={() => onSelect?.(c)}
              className={`p-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${
                isSel ? "bg-gray-200" : ""
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{title?.[0] || "?"}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {c.status || "-"}
                </div>
              </div>

              <ChannelIcon kind={c.channel_kind || c.channel} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Hook simples de debounce */
function useDebouncedValue(value, delayMs = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}
