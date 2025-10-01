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

const STATUS_MAP = {
  connected: { label: 'Conectado', className: 'bg-green-100 text-green-700' },
  connecting: { label: 'Conectando', className: 'bg-amber-100 text-amber-700' },
  disconnected: { label: 'Desconectado', className: 'bg-gray-100 text-gray-600' },
  error: { label: 'Erro', className: 'bg-red-100 text-red-700' },
  unknown: { label: 'Desconhecido', className: 'bg-gray-100 text-gray-600' },
};

function StatusPill({ status }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.unknown;
  return <span className={`text-xs px-2 py-1 font-medium rounded-full ${meta.className}`}>{meta.label}</span>;
}

export default function WhatsAppOfficialCard() {
  const toast = useToast();
  const { org } = useOrg();
  const [form, setForm] = useState({
    phoneNumberId: '',
    accessToken: '',
    displayPhoneNumber: '',
    businessName: '',
  });
  const [testTo, setTestTo] = useState('');
  const [state, setState] = useState({
    loading: true,
    status: 'unknown',
    subscribed: false,
    saving: false,
    subscribing: false,
    testing: false,
    disconnecting: false,
    lastError: null,
  });

  const canConnect = useMemo(
    () => Boolean(form.phoneNumberId.trim() && form.accessToken.trim()),
    [form.phoneNumberId, form.accessToken]
  );
  const canTest = useMemo(() => Boolean(testTo.trim()), [testTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProviderStatus('whatsapp_cloud');
        const integration = data?.integration || data;
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          status: integration?.status || 'disconnected',
          subscribed: Boolean(integration?.subscribed),
          lastError: integration?.meta?.lastError || null,
        }));
        if (integration?.meta) {
          setForm((prev) => ({
            ...prev,
            phoneNumberId: integration.meta.phone_number_id || prev.phoneNumberId,
            displayPhoneNumber: integration.meta.display_phone_number || prev.displayPhoneNumber,
            businessName: integration.meta.business_name || prev.businessName,
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
      const response = await connectProvider('whatsapp_cloud', {
        phone_number_id: form.phoneNumberId,
        access_token: form.accessToken,
        display_phone_number: form.displayPhoneNumber || undefined,
        business_name: form.businessName || undefined,
      });
      const integration = response?.integration || response;
      setState((prev) => ({
        ...prev,
        saving: false,
        status: integration?.status || 'connected',
        subscribed: Boolean(integration?.subscribed),
        lastError: integration?.meta?.lastError || null,
      }));
      toast({ title: 'WhatsApp Cloud conectado', description: org?.name });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao conectar';
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: 'Erro ao conectar WhatsApp Cloud', description: message });
    }
  };

  const handleSubscribe = async () => {
    setState((prev) => ({ ...prev, subscribing: true, lastError: null }));
    try {
      const response = await subscribeProvider('whatsapp_cloud');
      const integration = response?.integration || response;
      setState((prev) => ({
        ...prev,
        subscribing: false,
        subscribed: Boolean(integration?.subscribed ?? true),
        status: integration?.status || prev.status,
        lastError: integration?.meta?.lastError || null,
      }));
      toast({ title: 'Webhook assinado com sucesso' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao assinar webhook';
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
      await testProvider('whatsapp_cloud', { to: testTo });
      setState((prev) => ({ ...prev, testing: false }));
      toast({ title: 'Mensagem de teste enviada', description: `Destino: ${testTo}` });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao enviar teste';
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
      const response = await disconnectProvider('whatsapp_cloud');
      const integration = response?.integration || response;
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        status: integration?.status || 'disconnected',
        subscribed: false,
        lastError: integration?.meta?.lastError || null,
      }));
      toast({ title: 'WhatsApp Cloud desconectado' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Falha ao desconectar';
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
      <div className="rounded-2xl border bg-white p-6 animate-pulse" data-testid="whatsapp-cloud-card-loading">
        Carregando integração WhatsApp Cloud…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" data-testid="whatsapp-cloud-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">WhatsApp Business Platform</h3>
          <p className="text-sm text-gray-500">Conecte um número oficial via API Cloud.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <StatusPill status={state.status} />
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${state.subscribed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {state.subscribed ? 'Webhook ativo' : 'Webhook inativo'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-testid="whatsapp-cloud-form">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Phone Number ID</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.phoneNumberId}
            onChange={(event) => setForm((prev) => ({ ...prev, phoneNumberId: event.target.value }))}
            placeholder="ID fornecido pelo Business Manager"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Access Token</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.accessToken}
            onChange={(event) => setForm((prev) => ({ ...prev, accessToken: event.target.value }))}
            placeholder="Token com permissão de envio"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Número exibido</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.displayPhoneNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, displayPhoneNumber: event.target.value }))}
            placeholder="Ex.: +55 11 99999-0000"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Nome do negócio</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={form.businessName}
            onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
            placeholder="Nome exibido nas conversas"
          />
        </label>
      </div>

      {state.lastError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="whatsapp-cloud-error">
          {String(state.lastError)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3" data-testid="whatsapp-cloud-actions">
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
          onClick={handleSubscribe}
          disabled={state.subscribing || state.status === 'disconnected'}
        >
          {state.subscribing ? 'Assinando…' : 'Assinar Webhook'}
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
            disabled={state.testing || !canTest}
          >
            {state.testing ? 'Enviando…' : 'Enviar teste'}
          </button>
        </div>
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
