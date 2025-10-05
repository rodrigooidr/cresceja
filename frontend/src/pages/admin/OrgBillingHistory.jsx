// ===== CODEx: BEGIN OrgBillingHistory.jsx =====
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrgBillingHistory } from "@/api/admin/orgsApi";
import { centsToBRL } from "@/api/inboxApi";

export default function OrgBillingHistory() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ invoices: [], plan_events: [], credits: [] });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const resp = await getOrgBillingHistory(id);
        if (mounted) setData(resp || { invoices: [], plan_events: [], credits: [] });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="p-4">Carregando…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Histórico da organização</h1>
        <Link to="/admin/organizations" className="btn btn-ghost">Voltar</Link>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Pagamentos / Faturas</h2>
        {data.invoices.length === 0 ? (
          <div className="text-sm text-muted">Sem faturas cadastradas.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Pago em</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((f) => (
                <tr key={f.id}>
                  <td>{f.external_id || f.id.slice(0,8)}</td>
                  <td>{f.status}</td>
                  <td>{centsToBRL(f.amount_cents || 0)}</td>
                  <td>{f.due_date ? new Date(f.due_date).toLocaleString() : "—"}</td>
                  <td>{f.paid_at ? new Date(f.paid_at).toLocaleString() : "—"}</td>
                  <td>{new Date(f.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Eventos de Plano</h2>
        {data.plan_events.length === 0 ? (
          <div className="text-sm text-muted">Sem eventos.</div>
        ) : (
          <ul className="space-y-2">
            {data.plan_events.map((e) => (
              <li key={e.id} className="p-3 rounded border">
                <div className="text-sm">
                  <b>{e.event_type}</b> — {new Date(e.created_at).toLocaleString()}
                </div>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(e.data, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Consumo de Recursos</h2>
        {data.credits.length === 0 ? (
          <div className="text-sm text-muted">Sem registros.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Usado</th>
                <th>Início</th>
                <th>Fim</th>
              </tr>
            </thead>
            <tbody>
              {data.credits.map((c) => (
                <tr key={c.id}>
                  <td>{c.meter}</td>
                  <td>{c.used}</td>
                  <td>{new Date(c.period_start).toLocaleDateString()}</td>
                  <td>{new Date(c.period_end).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
// ===== CODEx: END OrgBillingHistory.jsx =====
