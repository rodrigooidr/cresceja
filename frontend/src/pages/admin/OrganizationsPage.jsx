import React, { useEffect, useMemo, useState } from "react";
import inboxApi from "../../api/inboxApi";

function coerceItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function OrganizationsPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState({ loading: true, error: null, items: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const tryGet = async (url) => {
          const res = await inboxApi.get(url, { params: q ? { q } : undefined });
          return coerceItems(res?.data);
        };

        let items = [];
        try { items = await tryGet("/admin/orgs"); }
        catch {
          try { items = await tryGet("/admin/organizations"); }
          catch {
            try { items = await tryGet("/orgs"); }
            catch { items = await tryGet("/organizations"); }
          }
        }

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
    name: o.name || o.nome || o.title || "—",
    plan: o.plan?.name || o.plan || o.plano || "—",
    status: o.status || "—",
  })), [state.items]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Organizações</h1>

      <input
        className="input input-bordered w-full max-w-md mb-4"
        placeholder="Buscar..."
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      {state.loading && <div>Carregando...</div>}
      {state.error && <div className="text-red-600 mb-2">Erro: {state.error}</div>}
      {!state.loading && rows.length === 0 && <div>Nenhuma organização encontrada.</div>}

      {rows.length > 0 && (
        <div data-testid="orgs-table" className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.plan}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 text-right space-x-4">
                    <a className="text-blue-600 hover:underline" href={`/orgs/${r.id}`}>Ver</a>
                    <a className="text-blue-600 hover:underline" href={`/admin/impersonate/${r.id}`}>Impersonar</a>
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
