// src/components/PricingTable.jsx
import React, { useEffect, useState } from "react";
import inboxApi from "../api/inboxApi";

function fmtBRL(cents, currency = "BRL") {
  if (!Number.isFinite(cents)) return "—";
  if (cents === 0) return "Grátis";
  try {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
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
        setState({ loading: false, items: [], error: e?.message || "Falha ao carregar planos" });
      }
    })();
    return () => { alive = false; };
  }, [endpoint]);

  if (state.loading) return <div>Carregando planos…</div>;
  if (state.error)   return <div className="text-amber-700 text-sm">{state.error}</div>;
  if (!state.items.length) return <div className="text-sm text-gray-600">Nenhum plano disponível no momento.</div>;

  // Descobre a ordem dos recursos a partir do primeiro item
  const first = state.items[0] || {};
  const featureKeys = Object.keys(first.features || {});
  const featureRows = featureKeys.map((k) => ({
    code: k,
    label: first.features?.[k]?.label || k
  }));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-3 text-left">Recurso</th>
            {state.items.map((p) => (
              <th key={p.id || p.name} className="p-3 text-center">
                <div className="font-medium">{p.name || "Plano"}</div>
                <div className="text-sm text-gray-500">
                  {fmtBRL(p.price_cents, p.currency)}/mês
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureRows.map((fr) => (
            <tr key={fr.code} className="border-t">
              <td className="p-3 font-medium">{fr.label}</td>
              {state.items.map((p) => {
                const f = p?.features?.[fr.code] || {};
                const isTick =
                  f.showAsTick && (f.value === true || f.display === "Ilimitado");
                const text = f.showAsTick ? (isTick ? "✔" : "✖") : (f.display ?? "—");
                return (
                  <td key={`${p.id || p.name}-${fr.code}`} className="p-3 text-center">
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
