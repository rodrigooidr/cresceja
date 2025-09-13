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

  const loadStatus = async () => {
    const { data } = await api.get("admin/orgs/whatsapp/status", { params: { id: orgId } });
    setStatus(data);
  };

  useEffect(() => {
    loadStatus();
  }, [orgId]);

  if (!status) return <div>Carregando…</div>;

  // esconder/disable quando não permitido
  const canSeeBaileys = status?.allow_baileys === true; // backend já expõe essa flag
  const isApiActive = status?.mode === 'api';
  const isBaileysActive = status?.mode === 'baileys';

  const handleConnectBaileys = () => api.post(`admin/orgs/${orgId}/baileys/connect`).then(loadStatus);
  const handleConnectApi = () => api.post(`admin/orgs/${orgId}/api-whatsapp/connect`).then(loadStatus);
  const toggleAllow = () => api.put(`admin/orgs/${orgId}/whatsapp/allow_baileys`, { allow: !status.allow_baileys }).then(loadStatus);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded border">
        <b>Modo ativo:</b> {status.mode}
      </div>

      <div>
        <button className="btn btn-sm mb-4" onClick={toggleAllow}>
          {status.allow_baileys ? 'Revogar Baileys' : 'Permitir Baileys'}
        </button>
      </div>

      {canSeeBaileys && (
        <section className="rounded border p-4">
          <h3 className="font-semibold mb-2">Baileys</h3>
          <button
            className="btn btn-primary"
            onClick={handleConnectBaileys}
            disabled={isApiActive}
            title={isApiActive ? 'API ativa — desative para usar Baileys' : ''}
          >
            Conectar Baileys
          </button>
          <button
            className="btn ml-2"
            onClick={() => api.post(`admin/orgs/${orgId}/baileys/disconnect`).then(loadStatus)}
          >
            Desconectar Baileys
          </button>
        </section>
      )}

      <section className="rounded border p-4">
        <h3 className="font-semibold mb-2">API WhatsApp</h3>
        <button
          className="btn btn-primary"
          onClick={handleConnectApi}
          disabled={isBaileysActive}
          title={isBaileysActive ? 'Baileys ativo — desconecte para usar API' : ''}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [billing, setBilling] = useState(null);
  const [users, setUsers] = useState(null);
  const [logs, setLogs] = useState(null);

  const active = params.get("tab") || "overview";
  const setTab = (k) => setParams({ tab: k });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (active === 'overview') {
          const { data } = await api.get(`admin/orgs/${orgId}/overview`);
          if (!cancelled) setOverview(data.overview);
        } else if (active === 'billing') {
          const { data } = await api.get(`admin/orgs/${orgId}/billing`);
          if (!cancelled) setBilling(data);
        } else if (active === 'users') {
          const { data } = await api.get(`admin/orgs/${orgId}/users`);
          if (!cancelled) setUsers(data.users);
        } else if (active === 'logs') {
          const { data } = await api.get(`admin/orgs/${orgId}/logs`);
          if (!cancelled) setLogs(data.logs);
        }
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Falha ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, orgId]);

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

      {loading && <div>Carregando...</div>}
      {error && <div className="text-amber-700">{String(error)}</div>}
      {!loading && !error && (
        <div className="text-sm">
          {active === "overview" && overview && (
            <pre className="bg-gray-50 border rounded p-3 overflow-auto">{JSON.stringify(overview, null, 2)}</pre>
          )}

          {active === "billing" && billing && (
            <pre className="bg-gray-50 border rounded p-3 overflow-auto">{JSON.stringify(billing, null, 2)}</pre>
          )}

          {active === "whatsapp" && (
            <WhatsAppTab orgId={orgId} api={api} />
          )}

          {active === "integrations" && (
            <div className="text-gray-600">Integrações diversas (resumo). Para editar, use “Configurações &gt; abas”.</div>
          )}

          {active === "users" && users && (
            <ul className="list-disc pl-4">
              {users.map(u => (
                <li key={u.id}>{u.email} ({u.role})</li>
              ))}
            </ul>
          )}

          {active === "credits" && (
            <div className="text-gray-600">Créditos de IA, consumo e limites.</div>
          )}

          {active === "logs" && logs && (
            <ul className="list-disc pl-4">
              {logs.map(l => (
                <li key={l.id}>{l.method} {l.path}</li>
              ))}
            </ul>
          )}

          {active === "data" && (
            <div className="text-gray-600">Dump de dados/diagnóstico (somente para admins).</div>
          )}
        </div>
      )}
    </div>
  );
}

