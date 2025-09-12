// src/components/PricingTable.jsx
import React, { useEffect, useState } from "react";
import inboxApi from "../api/inboxApi";

function fmtBRL(cents, currency = "BRL") {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "Grátis";
  try {
    return (n / 100).toLocaleString("pt-BR", { style: "currency", currency });
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
}

export default function PricingTable({ endpoint = "/public/plans" }) {
  const [state, setState] = useState({ loading: true, items: [], error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await inboxApi.get(endpoint);
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!alive) return;
        setState({ loading: false, items, error: null });
      } catch (e) {
        if (!alive) return;
        setState({
          loading: false,
          items: [],
          error: e?.message || "Falha ao carregar planos",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  if (state.loading) return <div>Carregando planos…</div>;
  if (state.error) return <div className="text-amber-700 text-sm">Erro: {state.error}</div>;
  if (!state.items.length) {
    return (
      <div
        className="text-sm text-gray-600"
        data-testid="pricing-table"
        endpoint={endpoint}
      >
        Nenhum plano disponível no momento.
      </div>
    );
  }

  // Ordem de recursos baseada no primeiro item (se não houver, a tabela mostra só os preços)
  const first = state.items[0] || {};
  const featureKeys = Object.keys(first?.features || {});
  const featureRows = featureKeys.map((code) => ({
    code,
    label: first?.features?.[code]?.label ?? code,
  }));

  return (
    <div
      className="overflow-x-auto"
      data-testid="pricing-table"
      endpoint={endpoint}
    >
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-3 text-left">Recurso</th>
            {state.items.map((p, i) => (
              <th key={p?.id ?? p?.name ?? i} className="p-3 text-center">
                <div className="font-medium">{p?.name || "Plano"}</div>
                <div className="text-sm text-gray-500">
                  {fmtBRL(p?.price_cents, p?.currency)}/mês
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureRows.length === 0 ? (
            <tr className="border-t">
              <td className="p-3 text-sm text-gray-600">—</td>
              {state.items.map((p, i) => (
                <td key={`price-only-${p?.id ?? i}`} className="p-3 text-center">
                  {/* apenas preços quando não há features */}
                  {fmtBRL(p?.price_cents, p?.currency)}/mês
                </td>
              ))}
            </tr>
          ) : (
            featureRows.map((fr) => (
              <tr key={fr.code} className="border-t">
                <td className="p-3 font-medium">{fr.label}</td>
                {state.items.map((p, i) => {
                  const f = p?.features?.[fr.code] ?? null;
                  const showAsTick = !!f?.showAsTick;
                  const isTick =
                    showAsTick && (f?.value === true || f?.display === "Ilimitado");
                  const text = showAsTick ? (isTick ? "✔" : "✖") : f?.display ?? "—";
                  return (
                    <td
                      key={`${p?.id ?? p?.name ?? i}-${fr.code}`}
                      className="p-3 text-center"
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
