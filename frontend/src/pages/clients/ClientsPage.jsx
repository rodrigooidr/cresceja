import React, { useEffect, useMemo, useState } from "react";
import inboxApi from "../../api/inboxApi";
import { useAuth } from "../../auth/useAuth";
import { CAN_EDIT_CLIENTS } from "../../auth/roles";
import useWhatsApp from "../../hooks/useWhatsApp.js";
import { useOrg } from "../../contexts/OrgContext.jsx";

function coerce(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function ClientsPage() {
  const { user } = useAuth();
  const canEdit = CAN_EDIT_CLIENTS(user?.role);
  const { connected } = useWhatsApp();
  const { selected } = useOrg();

  const [q, setQ] = useState({ name: "", phone: "", email: "", tag: "", stage: "" });
  const [state, setState] = useState({ loading: true, error: null, items: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selected) {
        if (!alive) return;
        setState({ loading: false, error: "Selecione uma organização para listar/criar clientes.", items: [] });
        return;
      }
      try {
        setState((s) => ({ ...s, loading: true, error: null }));
        const res = await inboxApi.get("/clients", {
          params: { ...q, limit: 50, page: 1 },
        });
        const items = coerce(res?.data);
        if (!alive) return;
        setState({ loading: false, error: null, items });
      } catch (err) {
        if (!alive) return;
        setState({ loading: false, error: err?.message || "Falha ao carregar", items: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [q, selected]);

  async function addClient() {
    const name = prompt("Nome do cliente?") || "";
    if (!name.trim()) return;
    const email = prompt("E-mail do cliente?" ) || undefined;
    const phone = prompt("Telefone (E.164)?") || undefined;
    const tagsStr = prompt("Tags (separadas por vírgula)?") || "";
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : undefined;
    try {
      await inboxApi.post("clients", { name, email, phone_e164: phone, tags });
      setQ((s) => ({ ...s }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("add_client_fail", e);
    }
  }

  const rows = useMemo(() => state.items.map(c => ({
    id: c.id || c._id,
    name: c.name || "—",
    phone: c.phone || c.whatsapp || "—",
    email: c.email || "—",
    tags: Array.isArray(c.tags) ? c.tags : [],
    stage: c.crmStage || c.stage || "—",
    hasActiveWhatsapp: !!c.activeWhatsappConversation,
  })), [state.items]);

  async function startWhatsapp(id) {
    try {
      await inboxApi.post(`/clients/${id}/start-whatsapp`);
    } catch (e) {
      // mostrar erro amigável
    }
  }

  if (!selected) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Clientes</h1>
        <div className="p-4 bg-yellow-50 border rounded">
          Selecione uma organização
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Clientes</h1>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <input placeholder="Nome" value={q.name} onChange={e=>setQ(s=>({...s,name:e.target.value}))} className="input input-bordered"/>
        <input placeholder="Telefone/WhatsApp" value={q.phone} onChange={e=>setQ(s=>({...s,phone:e.target.value}))} className="input input-bordered"/>
        <input placeholder="E-mail" value={q.email} onChange={e=>setQ(s=>({...s,email:e.target.value}))} className="input input-bordered"/>
        <input placeholder="Tag" value={q.tag} onChange={e=>setQ(s=>({...s,tag:e.target.value}))} className="input input-bordered"/>
        <select value={q.stage} onChange={e=>setQ(s=>({...s,stage:e.target.value}))} className="select select-bordered">
          <option value="">Estágio</option>
          <option>Lead</option><option>Qualificado</option><option>Proposta</option><option>Fechado</option>
        </select>
      </div>

      {/* Ações topo */}
      <div className="mb-4 flex gap-2">
        {canEdit && (
          <button className="btn btn-primary" onClick={addClient}>
            Adicionar cliente
          </button>
        )}
      </div>

      {/* Tabela */}
      {state.loading && <div>Carregando…</div>}
      {state.error && <div className="text-red-600">Erro: {state.error}</div>}
      {!state.loading && rows.length === 0 && <div>Nenhum cliente encontrado.</div>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded border bg-white" data-testid="clients-table">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">WhatsApp</th>
                <th className="px-3 py-2 text-left">E-mail</th>
                <th className="px-3 py-2 text-left">Tags</th>
                <th className="px-3 py-2 text-left">Funil</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.phone}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.tags.join(", ")}</td>
                  <td className="px-3 py-2">{r.stage}</td>
                  <td className="px-3 py-2 text-right space-x-3">
                    {canEdit && <a className="text-blue-600" href={`/clients/${r.id}`}>Editar</a>}
                    {!r.hasActiveWhatsapp && connected && (
                      <button className="btn btn-sm" onClick={()=>startWhatsapp(r.id)}>
                        Iniciar conversa WhatsApp
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
