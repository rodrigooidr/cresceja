import React, { useEffect, useMemo, useState } from 'react';
import {
  getProviderStatus,
  connectProvider,
  testProvider,
  disconnectProvider,
} from '@/api/integrationsApi.js';
import useToast from '@/hooks/useToastFallback.js';
import { useOrg } from '@/contexts/OrgContext.jsx';

const STATUS_MAP = {
  connected: { label: 'Conectado', className: 'bg-green-100 text-green-700' },
  connecting: { label: 'Conectando', className: 'bg-amber-100 text-amber-700' },
  disconnected: { label: 'Desconectado', className: 'bg-gray-100 text-gray-600' },
  error: { label: 'Erro', className: 'bg-red-100 text-red-700' },
  unknown: { label: 'Desconhecido', className: 'bg-gray-100 text-gray-600' },
};

function StatusPill({ status }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.unknown;
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${meta.className}`} data-testid="status-pill">
      {meta.label}
    </span>
  );
}

export default function GoogleCalendarCard() {
  const toast = useToast();
  const { org } = useOrg();
  const [form, setForm] = useState({
    calendarId: '',
    clientEmail: '',
    privateKey: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const [state, setState] = useState({
    loading: true,
    status: 'unknown',
    saving: false,
    testing: false,
    disconnecting: false,
    lastError: null,
  });

  const canConnect = useMemo(
    () =>
      Boolean(
        form.calendarId.trim() &&
          form.clientEmail.trim() &&
          form.privateKey.trim() &&
          form.timezone.trim()
      ),
    [form]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProviderStatus('google_calendar');
        const integration = data?.integration || data;
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          status: integration?.status || 'disconnected',
          lastError: integration?.meta?.lastError || null,
        }));
        if (integration?.meta) {
          setForm((prev) => ({
            ...prev,
            calendarId: integration.meta.calendarId || '',
            clientEmail: integration.meta.clientEmail || '',
            timezone: integration.meta.timezone || prev.timezone,
            privateKey: '',
          }));
        }
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          status: 'error',
          lastError: err?.message || 'Falha ao carregar status',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = async () => {
    setState((prev) => ({ ...prev, saving: true, lastError: null }));
    try {
      const response = await connectProvider('google_calendar', {
        calendarId: form.calendarId,
        clientEmail: form.clientEmail,
        privateKey: form.privateKey,
        timezone: form.timezone,
      });
      const integration = response?.integration || response;
      setState((prev) => ({
        ...prev,
        saving: false,
        status: integration?.status || 'connected',
        lastError: integration?.meta?.lastError || null,
      }));
      toast({
        title: 'Google Calendar conectado',
        description: org?.name ? `Integração ativa para ${org.name}.` : undefined,
      });
      if (integration?.meta) {
        setForm((prev) => ({
          ...prev,
          calendarId: integration.meta.calendarId || prev.calendarId,
          clientEmail: integration.meta.clientEmail || prev.clientEmail,
          timezone: integration.meta.timezone || prev.timezone,
          privateKey: '',
        }));
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao conectar';
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: 'Falha ao conectar Google Calendar', description: message });
    }
  };

  const handleTest = async () => {
    setState((prev) => ({ ...prev, testing: true, lastError: null }));
    try {
      const response = await testProvider('google_calendar');
      const integration = response?.integration || {};
      setState((prev) => ({
        ...prev,
        testing: false,
        status: integration?.status || prev.status,
        lastError: integration?.meta?.lastError || null,
      }));
      toast({ title: 'Teste enviado', description: 'Evento de teste agendado com sucesso.' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao testar';
      setState((prev) => ({
        ...prev,
        testing: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: 'Falha no teste', description: message });
    }
  };

  const handleDisconnect = async () => {
    setState((prev) => ({ ...prev, disconnecting: true, lastError: null }));
    try {
      const response = await disconnectProvider('google_calendar');
      const integration = response?.integration || response;
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        status: integration?.status || 'disconnected',
        lastError: integration?.meta?.lastError || null,
      }));
      setForm((prev) => ({ ...prev, privateKey: '' }));
      toast({ title: 'Google Calendar desconectado' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao desconectar';
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: 'Falha ao desconectar', description: message });
    }
  };

  if (state.loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 animate-pulse" data-testid="google-calendar-card-loading">
        Carregando Google Calendar…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm" data-testid="google-calendar-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Google Calendar</h3>
          <p className="text-sm text-gray-500">Sincronize eventos através de uma conta de serviço.</p>
        </div>
        <StatusPill status={state.status} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2" data-testid="google-calendar-form">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Calendar ID</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.calendarId}
            onChange={(event) => setForm((prev) => ({ ...prev, calendarId: event.target.value }))}
            placeholder="primary ou id@group.calendar.google.com"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Client Email</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.clientEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, clientEmail: event.target.value }))}
            placeholder="service-account@project.iam.gserviceaccount.com"
          />
        </label>
        <label className="md:col-span-2 grid gap-1 text-sm">
          <span className="font-medium">Private Key</span>
          <textarea
            className="min-h-[120px] rounded-lg border px-3 py-2 font-mono"
            value={form.privateKey}
            onChange={(event) => setForm((prev) => ({ ...prev, privateKey: event.target.value }))}
            placeholder="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Timezone</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.timezone}
            onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
            placeholder="America/Sao_Paulo"
          />
        </label>
      </div>

      {state.lastError ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="google-calendar-error">
          {String(state.lastError)}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="google-calendar-actions">
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleConnect}
          disabled={!canConnect || state.saving}
        >
          {state.saving ? 'Conectando…' : 'Conectar'}
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleTest}
          disabled={state.testing || state.status === 'disconnected'}
        >
          {state.testing ? 'Testando…' : 'Testar'}
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleDisconnect}
          disabled={state.disconnecting || state.status === 'disconnected'}
        >
          {state.disconnecting ? 'Desconectando…' : 'Desconectar'}
        </button>
      </div>
    </div>
  );
}
