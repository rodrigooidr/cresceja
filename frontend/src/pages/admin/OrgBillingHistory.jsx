import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminGetOrgBillingHistory, adminListPlansShort, adminPutOrgPlan } from '../../api/inboxApi';
import { saveAs } from 'file-saver';

export default function OrgBillingHistory() {
  const { orgId } = useParams();
  const [data, setData] = useState({ invoices: [], plan_events: [], usage: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [plans, setPlans] = useState([]);
  const [changing, setChanging] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [hist, ps] = await Promise.all([
          adminGetOrgBillingHistory(orgId),
          adminListPlansShort()
        ]);
        if (!alive) return;
        setData(hist || { invoices: [], plan_events: [], usage: [] });
        setPlans(ps);
      } catch (e) {
        if (!alive) return;
        setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orgId]);

  const csv = useMemo(() => {
    const rows = [
      ['type','created_at','amount','description','meta'],
      ...data.invoices.map(i => ['invoice', i.created_at, i.amount ?? '', i.description ?? '', JSON.stringify(i)]),
      ...data.plan_events.map(p => ['plan_event', p.created_at, '', p.event ?? '', JSON.stringify(p)]),
      ...data.usage.map(u => ['usage', u.created_at, u.qty ?? '', u.meter ?? '', JSON.stringify(u)]),
    ];
    return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  }, [data]);

  function exportCsv() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `org-${orgId}-history.csv`);
  }

  async function changePlan() {
    if (!selectedPlan) return;
    setChanging(true);
    try {
      await adminPutOrgPlan(orgId, selectedPlan);
      // recarrega histórico para refletir novo evento de plano
      const hist = await adminGetOrgBillingHistory(orgId);
      setData(hist || { invoices: [], plan_events: [], usage: [] });
      alert('Plano atualizado');
    } catch (e) {
      alert('Falha ao mudar o plano');
    } finally {
      setChanging(false);
    }
  }

  if (loading) return <div>Carregando…</div>;
  if (err) return <div style={{color:'crimson'}}>ERRO<br/>{String(err?.message || err)}</div>;

  return (
    <div className="container">
      <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:16}}>
        <Link to="/admin/organizations" className="btn btn-light">Voltar</Link>
        <button className="btn btn-secondary" onClick={exportCsv}>Exportar CSV</button>
        <div style={{marginLeft:'auto'}} />
        <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
          <option value="">— Mudar plano —</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!selectedPlan || changing} onClick={changePlan}>
          {changing ? 'Trocando…' : 'Mudar plano'}
        </button>
      </div>

      <h3>Pagamentos / Faturas</h3>
      {data.invoices?.length ? (
        <ul>
          {data.invoices.map(inv => (
            <li key={inv.id || inv.created_at}>{inv.created_at} — {inv.description || 'Fatura'}</li>
          ))}
        </ul>
      ) : <p>Sem faturas cadastradas.</p>}

      <h3>Eventos de Plano</h3>
      {data.plan_events?.length ? (
        <ul>
          {data.plan_events.map(ev => (
            <li key={ev.id || ev.created_at}>{ev.created_at} — {ev.event || 'evento'}</li>
          ))}
        </ul>
      ) : <p>Sem registros.</p>}

      <h3>Consumo de Recursos</h3>
      {data.usage?.length ? (
        <ul>
          {data.usage.map(us => (
            <li key={us.id || us.created_at}>{us.created_at} — {us.meter}: {us.qty}</li>
          ))}
        </ul>
      ) : <p>Sem registros.</p>}
    </div>
  );
}
