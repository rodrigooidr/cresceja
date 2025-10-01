import React, { useEffect, useMemo, useState } from 'react';
import {
  getProviderStatus,
  connectProvider,
  testProvider,
  disconnectProvider,
} from '@/api/integrationsApi.js';
import useToast from '@/hooks/useToastFallback.js';
import { useOrg } from '@/contexts/OrgContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import StatusPill from './StatusPill.jsx';
import InlineSpinner from '../InlineSpinner.jsx';

export default function WhatsAppBaileysCard() {
  const toast = useToast();
  const { org } = useOrg();
  const { user } = useAuth();
  const [sessionHost, setSessionHost] = useState('');
  const [testTo, setTestTo] = useState('');
  const [state, setState] = useState({
    loading: true,
    status: 'unknown',
    saving: false,
    testing: false,
    disconnecting: false,
    lastError: null,
    meta: {},
  });

  const canTest = useMemo(() => Boolean(testTo.trim()), [testTo]);
  const testOnlyEmail = state.meta?.test_only_email || null;
  const restricted = Boolean(testOnlyEmail && user?.email && user.email !== testOnlyEmail);

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
        const data = await getProviderStatus('whatsapp_session');
        const integration = data?.integration || data;
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false }));
        applyIntegration(integration);
        if (integration?.meta?.session_host) {
          setSessionHost(integration.meta.session_host);
        }
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
      const response = await connectProvider('whatsapp_session', {
        session_host: sessionHost || undefined,
      });
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, saving: false }));
      toast({ title: 'Sessão WhatsApp iniciada', description: org?.name });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao iniciar sessão');
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: 'Erro ao iniciar sessão', description: message });
    }
  };

  const handleTest = async () => {
    setState((prev) => ({ ...prev, testing: true, lastError: null }));
    try {
      const response = await testProvider('whatsapp_session', { to: testTo });
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, testing: false }));
      toast({ title: 'Mensagem de teste enviada', description: `Destino: ${testTo}` });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao enviar teste');
      setState((prev) => ({
        ...prev,
        testing: false,
        lastError: message,
      }));
      toast({ title: 'Erro no teste', description: message });
    }
  };

  const handleDisconnect = async () => {
    setState((prev) => ({ ...prev, disconnecting: true, lastError: null }));
    try {
      const response = await disconnectProvider('whatsapp_session');
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        status: integration?.status || 'disconnected',
      }));
      toast({ title: 'Sessão encerrada' });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao desconectar');
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        lastError: message,
      }));
      toast({ title: 'Erro ao desconectar', description: message });
    }
  };

  if (state.loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 animate-pulse" data-testid="whatsapp-session-card-loading">
        Carregando sessão WhatsApp…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" data-testid="whatsapp-session-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">WhatsApp Sessão (Baileys)</h3>
          <p className="text-sm text-gray-500">Utilize uma sessão autenticada por QR Code.</p>
          {restricted ? (
            <p className="mt-1 text-xs text-amber-600" data-testid="whatsapp-session-restricted">
              Modo restrito: disponível apenas para {testOnlyEmail}.
            </p>
          ) : null}
        </div>
        <StatusPill status={state.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-testid="whatsapp-session-form">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Host do serviço</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={sessionHost}
            onChange={(event) => setSessionHost(event.target.value)}
            placeholder="https://seu-host-de-sessao"
          />
        </label>
        <div className="grid gap-1 text-sm">
          <span className="font-medium">Último status</span>
          <div className="rounded-lg border px-3 py-2 text-sm text-gray-600" data-testid="whatsapp-session-meta">
            {state.meta?.session_state || 'N/D'}
          </div>
        </div>
      </div>

      {state.lastError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="whatsapp-session-error">
          {String(state.lastError)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3" data-testid="whatsapp-session-actions">
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleConnect}
          disabled={state.saving || restricted}
        >
          {renderActionLabel(state.saving, 'Iniciar sessão', 'Iniciando…')}
        </button>
        <div className="flex items-center gap-2">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            value={testTo}
            onChange={(event) => setTestTo(event.target.value)}
            placeholder="Telefone para teste"
          />
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleTest}
            disabled={state.testing || !canTest || restricted}
          >
            {renderActionLabel(state.testing, 'Enviar teste', 'Enviando…')}
          </button>
        </div>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleDisconnect}
          disabled={state.disconnecting || state.status === 'disconnected'}
        >
          {renderActionLabel(state.disconnecting, 'Encerrar sessão', 'Encerrando…')}
        </button>
      </div>
    </div>
  );
}
