import React, { useEffect, useMemo, useState } from 'react';
import {
  getProviderStatus,
  connectProvider,
  subscribeProvider,
  testProvider,
  disconnectProvider,
} from '@/api/integrationsApi.js';
import useToast from '@/hooks/useToastFallback.js';
import { useOrg } from '@/contexts/OrgContext.jsx';
import StatusPill from './StatusPill.jsx';
import InlineSpinner from '../InlineSpinner.jsx';

export default function FacebookCard() {
  const toast = useToast();
  const { org } = useOrg();
  const [form, setForm] = useState({
    accessToken: '',
    pageId: '',
    pageName: '',
  });
  const [state, setState] = useState({
    loading: true,
    status: 'unknown',
    subscribed: false,
    saving: false,
    subscribing: false,
    testing: false,
    disconnecting: false,
    lastError: null,
    meta: {},
  });

  const canConnect = useMemo(() => Boolean(form.accessToken.trim()), [form.accessToken]);

  const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

  const applyIntegration = (integration) => {
    if (!integration) return;
    setState((prev) => ({
      ...prev,
      status: integration.status || prev.status || 'disconnected',
      subscribed: Boolean(integration.subscribed ?? prev.subscribed),
      meta: integration.meta || prev.meta,
      lastError: integration.meta?.lastError || null,
    }));
    if (integration.meta) {
      setForm((prev) => ({
        ...prev,
        pageId: integration.meta.page_id || prev.pageId,
        pageName: integration.meta.page_name || prev.pageName,
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
        const data = await getProviderStatus('meta_facebook');
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
      const response = await connectProvider('meta_facebook', {
        user_access_token: form.accessToken,
        page_id: form.pageId || undefined,
        page_name: form.pageName || undefined,
      });
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, saving: false }));
      toast({ title: 'Facebook conectado', description: org?.name });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao conectar');
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: 'Erro ao conectar Facebook', description: message });
    }
  };

  const handleSubscribe = async () => {
    setState((prev) => ({ ...prev, subscribing: true, lastError: null }));
    try {
      const response = await subscribeProvider('meta_facebook');
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, subscribing: false }));
      toast({ title: 'Webhook do Facebook ativo' });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao assinar webhook');
      setState((prev) => ({
        ...prev,
        subscribing: false,
        lastError: message,
      }));
      toast({ title: 'Erro ao assinar webhook', description: message });
    }
  };

  const handleTest = async () => {
    setState((prev) => ({ ...prev, testing: true, lastError: null }));
    try {
      const response = await testProvider('meta_facebook');
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, testing: false }));
      toast({ title: 'Teste enviado', description: 'Simulação de publicação concluída.' });
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao testar');
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
      const response = await disconnectProvider('meta_facebook');
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        status: integration?.status || 'disconnected',
        subscribed: false,
      }));
      toast({ title: 'Facebook desconectado' });
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
      <div className="rounded-2xl border bg-white p-6 animate-pulse" data-testid="facebook-card-loading">
        Carregando integração Facebook…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" data-testid="facebook-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Facebook Pages</h3>
          <p className="text-sm text-gray-500">Gerencie comentários e mensagens das suas páginas.</p>
          {state.meta?.page_name ? (
            <p className="mt-1 text-xs text-gray-600" data-testid="facebook-meta">
              Página conectada: {state.meta.page_name}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <StatusPill status={state.status} />
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              state.subscribed
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-gray-200 bg-gray-100 text-gray-600'
            }`}
          >
            {state.subscribed ? 'Webhook ativo' : 'Webhook inativo'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3" data-testid="facebook-form">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">User Access Token</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.accessToken}
            onChange={(event) => setForm((prev) => ({ ...prev, accessToken: event.target.value }))}
            placeholder="Token gerado pelo Facebook"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Page ID</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.pageId}
            onChange={(event) => setForm((prev) => ({ ...prev, pageId: event.target.value }))}
            placeholder="ID da página"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Nome da página</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.pageName}
            onChange={(event) => setForm((prev) => ({ ...prev, pageName: event.target.value }))}
            placeholder="Nome amigável da página"
          />
        </label>
      </div>

      {state.lastError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="facebook-error">
          {String(state.lastError)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3" data-testid="facebook-actions">
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
          onClick={handleSubscribe}
          disabled={state.subscribing || state.status === 'disconnected'}
        >
          {renderActionLabel(state.subscribing, 'Assinar webhook', 'Assinando…')}
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
