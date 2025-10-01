import React, { useEffect, useMemo, useState } from 'react';
import {
  getProviderStatus,
  connectProvider,
  testProvider,
  disconnectProvider,
} from '@/api/integrationsApi.js';
import useToast from '@/hooks/useToastFallback.js';
import { useOrg } from '@/contexts/OrgContext.jsx';
import StatusPill from './StatusPill.jsx';
import InlineSpinner from '../InlineSpinner.jsx';

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
    meta: {},
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

  const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

  const applyIntegration = (integration) => {
    if (!integration) return;
    setState((prev) => ({
      ...prev,
      status: integration.status || prev.status || 'disconnected',
      meta: integration.meta || prev.meta,
      lastError: integration.meta?.lastError || null,
    }));
    if (integration.meta) {
      setForm((prev) => ({
        ...prev,
        calendarId: integration.meta.calendarId || prev.calendarId,
        clientEmail: integration.meta.clientEmail || prev.clientEmail,
        timezone: integration.meta.timezone || prev.timezone,
        privateKey: '',
      }));
    }
  };

  const renderActionLabel = (loading, label, loadingLabel) =>
    loading ? (
      <span className="inline-flex items-center gap-2">
        <InlineSpinner size="0.75rem" />
        {loadingLabel}
      </span>
    ) : (
      label
    );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProviderStatus('google_calendar');
        const integration = data?.integration || data;
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false }));
        applyIntegration(integration);
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          status: 'error',
          lastError: getErrorMessage(err, 'Falha ao carregar status'),
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
      applyIntegration(integration);
      setState((prev) => ({ ...prev, saving: false }));
      toast({
        title: 'Google Calendar conectado',
        description: org?.name ? `Integração ativa para ${org.name}.` : undefined,
      });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao conectar');
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
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, testing: false }));
      toast({ title: 'Teste enviado', description: 'Evento de teste agendado com sucesso.' });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao testar');
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
      applyIntegration(integration);
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        status: integration?.status || 'disconnected',
      }));
      setForm((prev) => ({ ...prev, privateKey: '' }));
      toast({ title: 'Google Calendar desconectado' });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao desconectar');
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
          {state.meta?.calendarId ? (
            <p className="mt-1 text-xs text-gray-500">Calendário conectado: {state.meta.calendarId}</p>
          ) : null}
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
          {renderActionLabel(state.saving, 'Conectar', 'Conectando…')}
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleTest}
          disabled={state.testing || state.status === 'disconnected'}
        >
          {renderActionLabel(state.testing, 'Testar', 'Testando…')}
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleDisconnect}
          disabled={state.disconnecting || state.status === 'disconnected'}
        >
          {renderActionLabel(state.disconnecting, 'Desconectar', 'Desconectando…')}
        </button>
      </div>
    </div>
  );
}
