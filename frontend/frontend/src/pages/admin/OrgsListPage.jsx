import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import inboxApi from "../../api/inboxApi";
import useActiveOrgGate from "../../hooks/useActiveOrgGate";
import { useOrg } from "../../contexts/OrgContext.jsx";

export default function OrgsListPage({ minRole = "SuperAdmin" }) {
  const { allowed, reason } = useActiveOrgGate({ minRole, requireActiveOrg: false });
  const { setSelected } = useOrg();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [state, setState] = useState({ loading: true, items: [], error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Admin endpoint em ESCOPO GLOBAL (sem X-Org-Id)
        const res = await inboxApi.get("/admin/orgs", {
          params: { q },
          meta: { scope: "global" },
        });
        const raw = res?.data;
        const items =
          Array.isArray(raw?.items) ? raw.items :
          Array.isArray(raw?.orgs) ? raw.orgs :
          Array.isArray(raw) ? raw : [];
        if (!alive) return;
        setState({ loading: false, items, error: null });
      } catch (e) {
        if (!alive) return;
        const status = e?.response?.status;
        const msg =
          status === 401 || status === 403
            ? "Sem permissão para listar organizações."
            : e?.message || "Falha ao carregar organizações";
        setState({ loading: false, items: [], error: msg });
      }
    })();
    return () => { alive = false; };
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => setParams({ q }), 250);
    return () => clearTimeout(t);
  }, [q, setParams]);

  if (!allowed) return <div className="p-6 text-sm text-gray-600">Acesso bloqueado: {String(reason)}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Organizações</h1>

      <input
        className="border rounded-lg px-3 py-2 w-80"
        placeholder="Buscar..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="mt-4 border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Nome</th>
              <th className="p-3">Plano</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {state.loading && (
              <tr><td className="p-3" colSpan={4}>Carregando...</td></tr>
            )}
            {!state.loading && !state.items.length && !state.error && (
              <tr><td className="p-3" colSpan={4}>Nenhuma organização encontrada.</td></tr>
            )}
            {!state.loading && state.error && (
              <tr><td className="p-3 text-amber-700" colSpan={4}>{String(state.error)}</td></tr>
            )}
            {state.items.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">{o.name || o.slug || o.id}</td>
                <td className="p-3 text-center">{o.plan?.name || "-"}</td>
                <td className="p-3 text-center">{o.status || "-"}</td>
                <td className="p-3 text-right space-x-3">
                  <Link className="text-blue-600 hover:underline" to={`/admin/orgs/${o.id}`}>Ver</Link>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setSelected(o.id)}
                  >
                    Impersonar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
