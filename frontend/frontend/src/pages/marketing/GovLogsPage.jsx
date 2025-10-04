import React from "react";
import { fetchLogs } from "../../lib/audit.js";
import { toCSV, downloadCSV } from "../../lib/csv.js";

const EVENT_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "marketing.approve.success", label: "Aprovação OK" },
  { value: "marketing.approve.partial", label: "Aprovação Parcial" },
  { value: "marketing.approve.error", label: "Aprovação Erro" },
  { value: "marketing.approve.abort", label: "Aprovação Abortada" },
  { value: "marketing.revert.success", label: "Undo OK" },
  { value: "marketing.revert.error", label: "Undo Erro" },
  // WhatsApp
  { value: "whatsapp.incoming.message", label: "WA Inbound" },
  { value: "whatsapp.status.update", label: "WA Status" },
  { value: "whatsapp.typing", label: "WA Typing" },
  { value: "whatsapp.send.attempt", label: "WA Send Attempt" },
  { value: "whatsapp.send.success", label: "WA Send OK" },
  { value: "whatsapp.send.error", label: "WA Send Erro" },
  { value: "whatsapp.send.abort", label: "WA Send Abort" },
];

function fmtTs(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function GovLogsPage({ defaultLimit = 100 }) {
  const [event, setEvent] = React.useState("");
  const [limit, setLimit] = React.useState(defaultLimit);
  const [query, setQuery] = React.useState(""); // busca por jobId/suggestionId
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchLogs({ event, limit: Number(limit) || defaultLimit });
      setItems(res);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(); /* auto-load */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = React.useMemo(() => {
    if (!query) return items;
    const q = String(query).toLowerCase();
    return items.filter((it) => {
      const payload = it?.payload || {};
      return [payload.jobId, payload.suggestionId, it?.event, it?.actor?.name]
        .some((x) => String(x || "").toLowerCase().includes(q));
    });
  }, [items, query]);

  function doExport() {
    const rows = filtered.map((it) => ({
      id: it.id,
      ts: it.ts,
      time: fmtTs(it.ts),
      event: it.event,
      jobId: it?.payload?.jobId ?? "",
      suggestionId: it?.payload?.suggestionId ?? "",
      status: it?.payload?.status ?? "",
      bulk: it?.payload?.bulk ?? "",
      actorName: it?.actor?.name ?? "",
      actorRole: it?.actor?.role ?? "",
    }));
    const csv = toCSV(rows, {
      headers: [
        "id",
        "ts",
        "time",
        "event",
        "jobId",
        "suggestionId",
        "status",
        "bulk",
        "actorName",
        "actorRole",
      ],
    });
    downloadCSV(null, csv);
  }

  return (
    <div className="p-4 space-y-3" data-testid="gov-page">
      <h1 className="text-xl font-semibold">Governança &amp; Logs</h1>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col">
          <span className="text-sm">Evento</span>
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            data-testid="filter-event"
          >
            {EVENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-sm">Limite</span>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            style={{ width: 100 }}
            data-testid="filter-limit"
          />
        </label>
        <label className="flex flex-col grow">
          <span className="text-sm">Buscar (jobId, suggestionId, evento, ator)</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex.: j1 ou s3"
            data-testid="filter-query"
          />
        </label>
        <button onClick={load} disabled={loading} data-testid="btn-refresh">
          {loading ? "Carregando..." : "Atualizar"}
        </button>
        <button onClick={doExport} data-testid="btn-export">
          Exportar CSV
        </button>
      </div>

      <div role="table" className="w-full overflow-auto border rounded">
        <div role="row" className="grid grid-cols-8 gap-2 p-2 text-xs font-semibold border-b">
          <div>ID</div>
          <div>Horário</div>
          <div>Evento</div>
          <div>jobId</div>
          <div>suggestionId</div>
          <div>Status</div>
          <div>Bulk</div>
          <div>Ator</div>
        </div>
        {filtered.map((item) => (
          <div
            role="row"
            className="grid grid-cols-8 gap-2 p-2 text-xs border-b"
            key={item.id}
            data-testid="log-row"
          >
            <div title={item.id}>{String(item.id).slice(0, 10)}…</div>
            <div>{fmtTs(item.ts)}</div>
            <div>{item.event}</div>
            <div>{item?.payload?.jobId ?? ""}</div>
            <div>{item?.payload?.suggestionId ?? ""}</div>
            <div>{item?.payload?.status ?? ""}</div>
            <div>{String(item?.payload?.bulk ?? "")}</div>
            <div>
              {[item?.actor?.name, item?.actor?.role]
                .filter(Boolean)
                .join(" / ")}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-4 text-sm opacity-70">Sem registros.</div>
        )}
      </div>
    </div>
  );
}
