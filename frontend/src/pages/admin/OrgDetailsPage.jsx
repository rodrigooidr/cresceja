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

function WhatsAppTab({ orgId, api }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("admin/orgs/whatsapp/status", { params: { id: orgId } });
      setStatus(data);
    })();
  }, [orgId, api]);

  if (!status) return <div>Carregando…</div>;

  const mode = status.activeMode || status.mode;
  const allowBaileys = status.allowBaileys ?? status.allow_baileys;
  const isBaileysBlocked = mode === 'api';
  const isApiBlocked = mode === 'baileys';
  const hideBaileysForOrgAdmin = allowBaileys === false;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded border">
        <b>Modo ativo:</b> {status.activeMode}
      </div>

      {!hideBaileysForOrgAdmin && (
        <section className="rounded border p-4">
          <h3 className="font-semibold mb-2">Baileys</h3>
          <button
            className="btn btn-primary"
            disabled={isBaileysBlocked}
            title={isBaileysBlocked ? 'API está ativa. Desconecte a API para usar Baileys.' : ''}
            onClick={() => api.post(`admin/orgs/${orgId}/baileys/connect`)}
          >
            Conectar Baileys
          </button>
          <button
            className="btn ml-2"
            onClick={() => api.post(`admin/orgs/${orgId}/baileys/disconnect`)}
          >
            Desconectar Baileys
          </button>
        </section>
      )}

      <section className="rounded border p-4">
        <h3 className="font-semibold mb-2">API WhatsApp</h3>
        <button
          className="btn btn-primary"
          disabled={isApiBlocked}
          title={isApiBlocked ? 'Baileys está ativo. Desconecte o Baileys para usar a API.' : ''}
          onClick={() => api.post(`admin/orgs/${orgId}/api-whatsapp/connect`)}
        >
          Conectar API
        </button>
        <button
          className="btn ml-2"
          onClick={() => api.post(`admin/orgs/${orgId}/api-whatsapp/disconnect`)}
        >
          Desconectar API
        </button>
      </section>
    </div>
  );
}

export default function OrgDetailsPage({ minRole = "SuperAdmin" }) {
  const { id: orgId } = useParams();
  const { allowed, reason } = useActiveOrgGate({ minRole, requireActiveOrg: false });
  const api = {
    get: (url, opts = {}) =>
      inboxApi.get(url, {
        ...opts,
        meta: { ...(opts.meta || {}), impersonateOrgId: orgId },
      }),
    post: (url, body, opts = {}) =>
      inboxApi.post(url, body, {
        ...opts,
        meta: { ...(opts.meta || {}), impersonateOrgId: orgId },
      }),
    put: (url, body, opts = {}) =>
      inboxApi.put(url, body, {
        ...opts,
        meta: { ...(opts.meta || {}), impersonateOrgId: orgId },
      }),
  };
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const active = params.get("tab") || "overview";
  const setTab = (k) => setParams({ tab: k });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`admin/orgs/${orgId}`).catch(async () => {
          return api.get(`orgs/${orgId}`);
        });
        if (!alive) return;
        setState({ loading: false, data: res?.data || null, error: null });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, data: null, error: e?.message || "Falha ao carregar" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId, api]);

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
            <WhatsAppTab orgId={orgId} api={api} />
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

