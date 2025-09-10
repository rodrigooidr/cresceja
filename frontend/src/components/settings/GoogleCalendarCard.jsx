import React, { useEffect, useMemo, useState } from "react";
import inboxApi from "../../api/inboxApi";
import { useOrg } from "../../contexts/OrgContext"; // ajuste se o path for diferente

const StatusPill = ({ status }) => {
  const map = {
    connected: { text: "Conectado", cls: "bg-green-100 text-green-700" },
    disconnected: { text: "Desconectado", cls: "bg-gray-100 text-gray-700" },
    error: { text: "Erro", cls: "bg-red-100 text-red-700" },
    unknown: { text: "Desconhecido", cls: "bg-amber-100 text-amber-700" },
  };
  const s = map[status] || map.unknown;
  return <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.text}</span>;
};

export default function GoogleCalendarCard() {
  const { org } = useOrg();
  const [form, setForm] = useState({
    calendarId: "",
    clientEmail: "",
    privateKey: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const [state, setState] = useState({ loading: true, saving: false, testing: false, disconnecting: false, status: "unknown", lastError: null });

  const canConnect = useMemo(() => {
    return form.calendarId.trim() && form.clientEmail.trim() && form.privateKey.trim();
  }, [form]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await inboxApi.get(`/integrations/google-calendar/status`, { params: { orgId: org?.id } });
        const payload = res?.data || {};
        if (!alive) return;
        setState(s => ({ ...s, loading: false, status: payload?.status || "disconnected", lastError: payload?.error || null }));
        if (payload?.config) {
          setForm(f => ({
            ...f,
            calendarId: payload.config.calendarId || "",
            clientEmail: payload.config.clientEmail || "",
            privateKey: payload.config.privateKey || "",
            timezone: payload.config.timezone || f.timezone,
          }));
        }
      } catch (e) {
        if (!alive) return;
        setState(s => ({ ...s, loading: false, status: "unknown", lastError: e?.message || "Falha ao carregar status" }));
      }
    })();
    return () => { alive = false; };
  }, [org?.id]);

  const connect = async () => {
    setState(s => ({ ...s, saving: true, lastError: null }));
    try {
      await inboxApi.post(`/integrations/google-calendar/connect`, { ...form, orgId: org?.id });
      setState(s => ({ ...s, saving: false, status: "connected" }));
    } catch (e) {
      setState(s => ({ ...s, saving: false, status: "error", lastError: e?.response?.data?.message || e?.message }));
    }
  };

  const test = async () => {
    setState(s => ({ ...s, testing: true, lastError: null }));
    try {
      await inboxApi.post(`/integrations/google-calendar/test`, { orgId: org?.id });
      setState(s => ({ ...s, testing: false, status: "connected" }));
    } catch (e) {
      setState(s => ({ ...s, testing: false, status: "error", lastError: e?.response?.data?.message || e?.message }));
    }
  };

  const disconnect = async () => {
    setState(s => ({ ...s, disconnecting: true, lastError: null }));
    try {
      await inboxApi.post(`/integrations/google-calendar/disconnect`, { orgId: org?.id });
      setState(s => ({ ...s, disconnecting: false, status: "disconnected" }));
    } catch (e) {
      setState(s => ({ ...s, disconnecting: false, status: "error", lastError: e?.response?.data?.message || e?.message }));
    }
  };

  if (state.loading) {
    return <div className="rounded-2xl border p-6 animate-pulse">Carregando Google Calendar…</div>;
  }

  return (
    <div className="rounded-2xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Google Calendar</h3>
        <StatusPill status={state.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Calendar ID</label>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="ex.: seuemail@projeto.iam.gserviceaccount.com / primary / id@group.calendar.google.com"
            value={form.calendarId}
            onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Service Account — Client Email</label>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="client_email do JSON"
            value={form.clientEmail}
            onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium">Service Account — Private Key</label>
          <textarea
            className="border rounded-lg px-3 py-2 font-mono min-h-[100px]"
            placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
            value={form.privateKey}
            onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Timezone</label>
          <input
            className="border rounded-lg px-3 py-2"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </div>
      </div>

      {state.lastError && (
        <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {String(state.lastError)}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          onClick={connect}
          disabled={!canConnect || state.saving}
        >
          {state.saving ? "Conectando..." : "Conectar"}
        </button>

        <button
          className="rounded-lg border px-4 py-2 disabled:opacity-60"
          onClick={test}
          disabled={state.testing}
        >
          {state.testing ? "Verificando..." : "Verificar Conectividade"}
        </button>

        <button
          className="rounded-lg border px-4 py-2 disabled:opacity-60"
          onClick={disconnect}
          disabled={state.disconnecting || state.status !== "connected"}
        >
          {state.disconnecting ? "Desconectando..." : "Desconectar"}
        </button>
      </div>
    </div>
  );
}

