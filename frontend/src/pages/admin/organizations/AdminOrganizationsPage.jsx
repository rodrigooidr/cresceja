import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import inboxApi from "../../../api/inboxApi";
import { useOrg } from "../../../contexts/OrgContext.jsx";
import OrgCreateModal from "./OrgCreateModal.jsx";

function coerce(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function AdminOrganizationsPage() {
  const [q, setQ] = useState({ name: "", email: "", phone: "", plan: "", status: "", periodFrom: "", periodTo: "" });
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setSelected } = useOrg();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setState(s => ({ ...s, loading: true, error: null }));
        const res = await inboxApi.get("/admin/orgs", { params: q });
        const items = coerce(res?.data);
        if (!alive) return;
        setState({ loading: false, error: null, items });
      } catch (err) {
        if (!alive) return;
        setState({ loading: false, error: err?.message || "Falha ao carregar", items: [] });
      }
    })();
    return () => { alive = false; };
  }, [q]);

  const rows = useMemo(() => state.items.map(o => ({
    id: o.id || o._id,
    company: o.company?.name || o.name || "—",
    ownerName: o.owner?.name || "—",
    ownerEmail: o.owner?.email || "—",
    plan: o.plan?.name || o.plan || "—",
    period: o.subscription?.period || "—",
    status: o.status || "—",
  })), [state.items]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Organizações (Assinantes)</h1>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <input placeholder="Empresa ou cliente" value={q.name} onChange={e=>setQ(s=>({...s,name:e.target.value}))} className="input input-bordered"/>
        <input placeholder="E-mail" value={q.email} onChange={e=>setQ(s=>({...s,email:e.target.value}))} className="input input-bordered"/>
        <input placeholder="Telefone" value={q.phone} onChange={e=>setQ(s=>({...s,phone:e.target.value}))} className="input input-bordered"/>
        <input placeholder="Plano" value={q.plan} onChange={e=>setQ(s=>({...s,plan:e.target.value}))} className="input input-bordered"/>
        <select value={q.status} onChange={e=>setQ(s=>({...s,status:e.target.value}))} className="select select-bordered">
          <option value="">Status</option>
          <option>Ativo</option><option>Trial</option><option>Suspenso</option><option>Cancelado</option>
        </select>
        <div className="flex gap-2">
          <input type="date" value={q.periodFrom} onChange={e=>setQ(s=>({...s,periodFrom:e.target.value}))} className="input input-bordered"/>
          <input type="date" value={q.periodTo} onChange={e=>setQ(s=>({...s,periodTo:e.target.value}))} className="input input-bordered"/>
        </div>
      </div>

      {/* Ações topo */}
      <div className="mb-4 flex gap-2">
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          Adicionar organização
        </button>
        {/* Quick KPIs */}
        <div className="ml-auto flex gap-3 text-sm">
          {/* Cards de relatório inteligente (ex.: total ativas, trials, inadimplentes) */}
        </div>
      </div>

      {/* Tabela */}
      {state.loading && <div>Carregando…</div>}
      {state.error && <div className="text-red-600">Erro: {state.error}</div>}
      {!state.loading && rows.length === 0 && <div>Nenhuma organização encontrada.</div>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded border bg-white" data-testid="admin-orgs-table">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Assinante</th>
                <th className="px-3 py-2 text-left">Plano</th>
                <th className="px-3 py-2 text-left">Período</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.company}</td>
                  <td className="px-3 py-2">{r.ownerName} <span className="text-gray-500">({r.ownerEmail})</span></td>
                  <td className="px-3 py-2">{r.plan}</td>
                  <td className="px-3 py-2">{r.period}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-right space-x-3">
                    <a href={`/admin/organizations/${r.id}`} className="text-blue-600">Ver</a>
                    <a href={`/admin/organizations/${r.id}/history`} className="text-blue-600">Histórico</a>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => navigate(`/admin/organizations/${r.id}?tab=whatsapp`)}
                    >
                      Config. Baileys
                    </button>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => setSelected(r.id)}
                    >
                      Impersonar
                    </button>
                    {/* Ativar/Suspender por botão/confirm */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OrgCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => setQ((s) => ({ ...s }))}
      />
    </div>
  );
}
