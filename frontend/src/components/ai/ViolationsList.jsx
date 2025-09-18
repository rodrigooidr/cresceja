import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import inboxApi from "@/api/inboxApi.js";
import { Button } from "@/ui/controls/Input.jsx";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return String(value);
  }
}

export default function ViolationsList({ orgId = null, className = "" }) {
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [srMessage, setSrMessage] = useState("");

  const hasMore = useMemo(() => items.length >= limit, [items.length, limit]);

  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setItems([]);
      setError(null);
      setSrMessage("Selecione uma organização para visualizar violações");
      return undefined;
    }
    setLoading(true);
    setError(null);
    setSrMessage("Carregando violações recentes");

    inboxApi
      .get(`/orgs/${orgId}/ai/violations`, { params: { limit } })
      .then(({ data }) => {
        if (cancelled) return;
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        setItems(nextItems);
        setSrMessage(nextItems.length ? "Violações carregadas" : "Nenhuma violação registrada");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Não foi possível carregar as violações");
        setItems([]);
        setSrMessage("Erro ao carregar violações");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, limit]);

  const handleLoadMore = () => {
    setLimit((prev) => prev + 50);
  };

  return (
    <section className={`ui-card p-6 space-y-4 ${className || ""}`} data-testid="violations-list">
      <div className="sr-only" aria-live="polite" role="status">
        {srMessage}
      </div>

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Últimas violações</h2>
        <p className="text-sm text-slate-500">
          Visualize eventos recentes em que as respostas violaram regras dos guardrails.
        </p>
      </header>

      {loading && (
        <p className="text-sm text-slate-500" aria-live="polite">
          Carregando violações…
        </p>
      )}

      {error && !loading && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma violação registrada ainda.</p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.rule || "Regra"}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {item.stage === "post" ? "PÓS" : item.stage === "pre" ? "PRÉ" : item.stage || ""}
                </p>
              </div>
              <time className="text-[11px] text-slate-400">{formatDate(item.created_at)}</time>
            </div>

            {item.channel && (
              <p className="mt-2 text-[11px] text-slate-500">Canal: {item.channel}</p>
            )}

            {item.payload?.message && (
              <div className="mt-2 rounded bg-slate-50 p-2">
                <p className="text-[11px] font-semibold text-slate-700">Entrada</p>
                <p>{item.payload.message}</p>
              </div>
            )}

            {item.payload?.reply && (
              <div className="mt-2 rounded bg-amber-50 p-2">
                <p className="text-[11px] font-semibold text-amber-700">Resposta</p>
                <p>{item.payload.reply}</p>
              </div>
            )}

            {item.payload && !item.payload.message && !item.payload.reply && (
              <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px]">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>

      {hasMore && !loading && (
        <div className="flex justify-end">
          <Button type="button" onClick={handleLoadMore}>
            Carregar mais
          </Button>
        </div>
      )}
    </section>
  );
}

ViolationsList.propTypes = {
  orgId: PropTypes.string,
  className: PropTypes.string,
};

