import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import inboxApi from "../../api/inboxApi";
import useActiveOrgGate from "../../hooks/useActiveOrgGate";

function TabButton({ k, active, onClick, children }) {
  return (
    <button
      onClick={() => onClick(k)}
      className={`px-3 py-2 -mb-px border-b-2 ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"}`}
    >
      {children}
    </button>
  );
}

function WhatsAppTab({ orgId }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await inboxApi.get(`/admin/orgs/${orgId}/whatsapp/status`);
        if (!alive) return;
        setStatus(res.data);
      } catch (e) {
        if (!alive) return;
        setStatus({ error: e?.message || "Falha ao carregar" });
      }
    })();
    return () => { alive = false; };
  }, [orgId]);

  if (!status) return <div>Carregando status...</div>;
  if (status.error) return <div className="text-amber-700">{status.error}</div>;

  return (
    <div className="space-y-4">
      {status.allow_baileys && (
        <div className="border p-3 rounded">
          <div className="font-semibold mb-2">Baileys</div>
          <div className="mb-2">Status: {status.baileys.connected ? "conectado" : "desconectado"}</div>
          <button
            disabled={status.mode === 'api'}
            title={status.mode === 'api' ? 'Desconecte API para usar Baileys' : undefined}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Conectar Baileys
          </button>
        </div>
      )}

      <div className="border p-3 rounded">
        <div className="font-semibold mb-2">API</div>
        <div className="mb-2">Status: {status.api.connected ? "conectado" : "desconectado"}</div>
        <button
          disabled={status.mode === 'baileys'}
          title={status.mode === 'baileys' ? 'Desconecte Baileys para usar API' : undefined}
          className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Conectar API
        </button>
      </div>
    </div>
  );
}

export default function OrgDetailsPage({ minRole = "SuperAdmin" }) {
  const { orgId } = useParams();
  const { allowed, reason } = useActiveOrgGate({ minRole, requireActiveOrg: false });
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const active = params.get("tab") || "overview";
  const setTab = (k) => setParams({ tab: k });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await inboxApi.get(`/admin/orgs/${orgId}`).catch(async () => {
          return inboxApi.get(`/orgs/${orgId}`);
        });
        if (!alive) return;
        setState({ loading: false, data: res?.data || null, error: null });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, data: null, error: e?.message || "Falha ao carregar" });
      }
    })();
    return () => { alive = false; };
  }, [orgId]);

  const sections = useMemo(() => ([
    "overview","billing","whatsapp","integrations","users","credits","logs","data"
  ]), []);

  if (!allowed) return <div className="p-6 text-sm text-gray-600">Acesso bloqueado: {String(reason)}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Organização {orgId}</h1>

      <div className="border-b mb-4 flex gap-4">
        {sections.map(k => (
          <TabButton key={k} k={k} active={active === k} onClick={setTab}>
            {k}
          </TabButton>
        ))}
      </div>

      {state.loading && <div>Carregando...</div>}
      {state.error && <div className="text-amber-700">{String(state.error)}</div>}
      {!state.loading && state.data && (
        <div className="text-sm">
          {active === "overview" && (
            <pre className="bg-gray-50 border rounded p-3 overflow-auto">{JSON.stringify(state.data, null, 2)}</pre>
          )}

          {active === "billing" && (
            <div className="space-y-2">
              <div className="text-gray-600">Plano atual: {state.data?.org?.plan?.name || "-"}</div>
              <div className="text-gray-600">Trial até: {state.data?.org?.trial_ends_at || "-"}</div>
            </div>
          )}

          {active === "whatsapp" && (
            <WhatsAppTab orgId={orgId} />
          )}

          {active === "integrations" && (
            <div className="text-gray-600">Integrações diversas (resumo). Para editar, use “Configurações &gt; abas”.</div>
          )}

          {active === "users" && (
            <div className="text-gray-600">Lista de usuários da org (implementar fetch quando a API estiver disponível).</div>
          )}

          {active === "credits" && (
            <div className="text-gray-600">Créditos de IA, consumo e limites.</div>
          )}

          {active === "logs" && (
            <div className="text-gray-600">Logs/Auditoria da org.</div>
          )}

          {active === "data" && (
            <div className="text-gray-600">Dump de dados/diagnóstico (somente para admins).</div>
          )}
        </div>
      )}
    </div>
  );
}

