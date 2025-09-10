import React, { useEffect, useState } from "react";
import inboxApi from "../api/inboxApi";

function fmtBRL(cents, currency='BRL') {
  if (cents === 0) return 'Grátis';
  return (cents/100).toLocaleString('pt-BR', { style: 'currency', currency });
}

export default function PricingTable() {
  const [data, setData] = useState({ items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await inboxApi.get("/public/plans");
        setData(data);
      } catch (e) {
        console.error("pricing_fetch_failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Carregando planos…</div>;

  // Coleta a ordem de features com base no primeiro item
  const featureKeys = Object.keys(data.items?.[0]?.features || {});
  const featureRows = featureKeys.map(k => ({
    code: k,
    label: data.items[0].features[k].label
  }));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-3 text-left">Recurso</th>
            {data.items.map(p => (
              <th key={p.id} className="p-3 text-center">
                {p.name}<div className="text-sm text-gray-500">{fmtBRL(p.price_cents, p.currency)}/mês</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureRows.map(fr => (
            <tr key={fr.code} className="border-t">
              <td className="p-3 font-medium">{fr.label}</td>
              {data.items.map(p => {
                const f = p.features[fr.code];
                const isTick = f.showAsTick && (f.value === true || f.display === 'Ilimitado');
                const text = f.showAsTick ? (isTick ? '✔' : '✖') : f.display;
                return (
                  <td key={p.id} className="p-3 text-center">{text || '—'}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
