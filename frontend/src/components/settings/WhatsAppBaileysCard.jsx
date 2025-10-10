import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getProviderStatus,
  connectProvider,
  testProvider,
  disconnectProvider,
  startBaileysQr,
  stopBaileysQr,
  statusBaileys,
  getBaileysSseToken,
} from '@/api/integrationsApi.js';
import inboxApi, { API_BASE_URL } from '@/api/inboxApi.js';
import useToast from '@/hooks/useToastFallback.js';
import { useOrg } from '@/contexts/OrgContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import StatusPill from './StatusPill.jsx';
import InlineSpinner from '../InlineSpinner.jsx';
import { getToastMessages, resolveIntegrationError } from './integrationMessages.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSseUrl(path = '/api/integrations/providers/whatsapp_session/qr/stream', token) {
  const base = (typeof API_BASE_URL === 'string' && API_BASE_URL) || '/api';
  const abs = base.startsWith('http') ? new URL(path, base) : new URL(path, window.location.origin);
  if (token) abs.searchParams.set('access_token', token);
  return abs.toString();
}

export function QRModal({ open, onClose, onConnected }) {
  const toast = useToast();
  const { org } = useOrg();
  const [status, setStatus] = useState('pending');
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);
  const esRef = useRef(null);
  const stoppingRef = useRef(false);
  const backoffRef = useRef(1000);
  const maxBackoff = 15000;

  const handleClose = useCallback(async () => {
    try {
      stoppingRef.current = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      await stopBaileysQr();
    } finally {
      stoppingRef.current = false;
      onClose?.();
    }
  }, [onClose]);

  const startStream = useCallback(async () => {
    try {
      setLoading(true);
      const { token, streamPath } = await getBaileysSseToken();
      await startBaileysQr();

      const url = buildSseUrl(
        streamPath || '/api/integrations/providers/whatsapp_session/qr/stream',
        token
      );
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'qr') {
            const dataUrl = msg?.qr?.dataUrl || msg?.qr || msg?.dataUrl;
            if (dataUrl) {
              setQr({ dataUrl });
              setStatus('pending');
            }
          }
          if (msg.type === 'status') {
            const st = String(msg.status || '').toLowerCase();
            if (st === 'connected' || st === 'ready') {
              setStatus('connected');
              toast({ title: 'Conectado com sucesso!' });
              onConnected?.();
              es?.close?.();
              esRef.current = null;
              handleClose();
            }
          }
        } catch {
          // ignore JSON parse errors
        }
      };

      es.onerror = async () => {
        if (stoppingRef.current) return;
        es.close();
        esRef.current = null;
        const wait = backoffRef.current;
        backoffRef.current = Math.min(maxBackoff, wait * 2);
        await sleep(wait);
        startStream();
      };

      backoffRef.current = 1000;
    } catch (err) {
      toast({
        title: 'Falha ao iniciar o stream do QR',
        description: err?.message,
      });
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [handleClose, onConnected, toast]);

  useEffect(() => {
    if (!open) return undefined;
    startStream();
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      stopBaileysQr().catch(() => {});
    };
  }, [open, startStream]);

  const title = useMemo(() => {
    if (status === 'connected') return 'Conectado';
    if (status === 'error') return 'Erro ao conectar';
    return 'Escaneie o QR no seu WhatsApp';
  }, [status]);

  return (
    <div role="dialog" aria-modal="true" className={`fixed inset-0 z-50 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            {loading && <InlineSpinner />}
          </div>

          {status !== 'error' && (
            <p className="text-sm text-gray-600 mb-4">
              Abra o WhatsApp &rarr; Menu &rarr; Aparelhos conectados &rarr; <b>Conectar um aparelho</b> e escaneie o QR abaixo.
            </p>
          )}

          {qr?.dataUrl ? (
            <img src={qr.dataUrl} alt="QR do WhatsApp" className="w-full rounded-xl border" />
          ) : (
            <div className="h-[256px] flex items-center justify-center border rounded-xl">
              <span className="text-gray-500 text-sm">Gerando QR…</span>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
            >
              Fechar
            </button>
          </div>

          {status === 'error' && (
            <p className="mt-3 text-sm text-red-600">Não foi possível iniciar o stream. Tente novamente.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const toastMessages = getToastMessages('whatsapp_session');

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
  const [featuresGate, setFeaturesGate] = useState({ loading: true, enabled: false, message: '' });
  const [qrOpen, setQrOpen] = useState(false);
  const defaultGateMessage = 'Recurso liberado somente por Suporte/SuperAdmin.';

  const getErrorMessage = useCallback(
    (error, fallbackKey) => resolveIntegrationError(error, fallbackKey),
    []
  );

  useEffect(() => {
    if (state.status === 'pending_qr' && !qrOpen) {
      setQrOpen(true);
    }
  }, [state.status, qrOpen]);

  const applyIntegration = useCallback((integration) => {
    if (!integration) return;
    setState((prev) => {
      const nextStatus = integration.status || prev.status || 'disconnected';
      const nextMeta = {
        ...prev.meta,
        ...(integration.meta || {}),
        session_state: integration.meta?.session_state || nextStatus,
      };
      return {
        ...prev,
        status: nextStatus,
        meta: nextMeta,
        lastError: nextMeta.lastError || null,
      };
    });
    if (integration?.meta?.session_host) {
      setSessionHost(integration.meta.session_host);
    }
  }, []);

  const refetchStatus = useCallback(
    async ({ cancelled } = {}) => {
      const isCancelled = () => (typeof cancelled === 'function' ? cancelled() : false);
      try {
        const data = await getProviderStatus('whatsapp_session');
        if (isCancelled()) return;
        const integration = data?.integration || data;
        setState((prev) => ({ ...prev, loading: false }));
        if (isCancelled()) return;
        applyIntegration(integration);
      } catch (err) {
        if (isCancelled()) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          status: 'error',
          lastError: getErrorMessage(err, 'load_status'),
        }));
      }
    },
    [applyIntegration, getErrorMessage]
  );

  useEffect(() => {
    let cancelled = false;
    void refetchStatus({ cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [refetchStatus]);

  useEffect(() => {
    let cancelled = false;
    if (!org?.id) {
      setFeaturesGate({ loading: false, enabled: false, message: defaultGateMessage });
      return () => {
        cancelled = true;
      };
    }

    setFeaturesGate((prev) => ({ ...prev, loading: true }));

    (async () => {
      try {
        const { data } = await inboxApi.get(`/api/orgs/${org.id}/features`);
        if (cancelled) return;
        const toggles = data?.feature_flags || data?.features || {};
        const enabled = Boolean(
          toggles.whatsapp_session_enabled ??
            toggles.whatsapp_session?.enabled ??
            toggles?.whatsapp_session_enabled?.enabled
        );
        setFeaturesGate({
          loading: false,
          enabled,
          message: enabled ? '' : defaultGateMessage,
        });
        if (enabled) {
          try {
            const statusData = await statusBaileys();
            if (!cancelled && statusData?.status) {
              setState((prev) => ({
                ...prev,
                status: statusData.status,
                meta: { ...prev.meta, session_state: statusData.status },
              }));
            }
          } catch (statusErr) {
            if (statusErr?.response?.status !== 403) {
              // eslint-disable-next-line no-console
              console.warn('[whatsapp-session] status fetch failed', statusErr);
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        const message = err?.response?.data?.message || defaultGateMessage;
        setFeaturesGate({ loading: false, enabled: false, message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [org?.id, defaultGateMessage]);

  const canTest = useMemo(() => Boolean(testTo.trim()), [testTo]);
  const testOnlyEmail = state.meta?.test_only_email || null;
  const restricted = Boolean(testOnlyEmail && user?.email && user.email !== testOnlyEmail);

  const renderActionLabel = (loading, label, loadingLabel) =>
    loading ? (
      <span className="inline-flex items-center gap-2">
        <InlineSpinner size="0.75rem" />
        {loadingLabel}
      </span>
    ) : (
      label
    );

  const handleConnect = async () => {
    setState((prev) => ({ ...prev, saving: true, lastError: null }));
    try {
      const response = await connectProvider('whatsapp_session', {
        session_host: sessionHost || undefined,
      });
      const integration = response?.integration || response;
      applyIntegration(integration);
      // força o fluxo de QR imediatamente após conectar
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'pending_qr',
        meta: { ...prev.meta, session_state: 'pending_qr' },
      }));

      if (integration?.requires_qr || integration?.status === 'pending_qr') {
        setQrOpen(true);
      } else {
        toast({
          title: toastMessages.connect_success || 'Sessão WhatsApp iniciada',
          description: org?.name,
        });
        // atualiza status
        void refetchStatus();
      }
    } catch (err) {
      const notFound = err?.response?.status === 404 || /not[\s_-]?found/i.test(err?.message || '');
      if (notFound) {
        try {
          await startBaileysQr();
          setQrOpen(true);
          setState((prev) => ({ ...prev, saving: false }));
          toast({
            title: 'Leia o QR para conectar',
            description: 'Sessão iniciada; o QR será exibido.',
          });
          return;
        } catch {
          /* cai no tratamento padrão abaixo */
        }
      }

      const message = getErrorMessage(err, 'connect');
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'error',
        lastError: message,
      }));
      toast({
        title: toastMessages.connect_error || 'Erro ao iniciar sessão',
        description: message,
      });
    }
  };

  const handleTest = async () => {
    setState((prev) => ({ ...prev, testing: true, lastError: null }));
    try {
      const response = await testProvider('whatsapp_session', { to: testTo });
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, testing: false }));
      toast({ title: toastMessages.test_success || 'Mensagem de teste enviada', description: `Destino: ${testTo}` });
    } catch (err) {
      const message = getErrorMessage(err, 'test');
      setState((prev) => ({
        ...prev,
        testing: false,
        lastError: message,
      }));
      toast({ title: toastMessages.test_error || 'Erro no teste', description: message });
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
      toast({ title: toastMessages.disconnect_success || 'Sessão encerrada' });
    } catch (err) {
      const message = getErrorMessage(err, 'disconnect');
      setState((prev) => ({
        ...prev,
        disconnecting: false,
        lastError: message,
      }));
      toast({ title: toastMessages.disconnect_error || 'Erro ao desconectar sessão', description: message });
    }
  };

  const handleOpenQr = () => {
    if (featuresGate.loading || !featuresGate.enabled || restricted) {
      return;
    }
    setState((prev) => ({
      ...prev,
      status: 'pending_qr',
      meta: { ...prev.meta, session_state: 'pending_qr' },
    }));
    setQrOpen(true);
  };

  const qrStatusLabel = useMemo(() => {
    switch (state.status) {
      case 'pending_qr':
        return 'Aguardando leitura…';
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'error':
        return 'Erro na sessão';
      default:
        return 'Status desconhecido';
    }
  }, [state.status]);

  const gateTooltip = !featuresGate.enabled ? featuresGate.message || defaultGateMessage : undefined;
  const qrButtonDisabled = featuresGate.loading || !featuresGate.enabled || restricted;
  const statusForPill = state.status === 'pending_qr' ? 'pending' : state.status;

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
        <StatusPill status={statusForPill} />
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
            {qrStatusLabel}
          </div>
        </div>
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {state.lastError ? String(state.lastError) : ''}
      </div>

      {state.lastError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="whatsapp-session-error">
          {String(state.lastError)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3" data-testid="whatsapp-session-actions">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleOpenQr}
            disabled={qrButtonDisabled}
            aria-busy={false}
            title={gateTooltip || undefined}
            data-testid="whatsapp-session-qr-button"
          >
            Gerar QR
          </button>
          {!featuresGate.loading && !featuresGate.enabled ? (
            <span className="text-xs text-gray-500" data-testid="whatsapp-session-qr-blocked">
              {featuresGate.message || defaultGateMessage}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleConnect}
          disabled={state.saving || restricted}
          aria-busy={state.saving}
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
            aria-busy={state.testing}
          >
            {renderActionLabel(state.testing, 'Enviar teste', 'Enviando…')}
          </button>
        </div>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleDisconnect}
          disabled={state.disconnecting || state.status === 'disconnected'}
          aria-busy={state.disconnecting}
        >
          {renderActionLabel(state.disconnecting, 'Encerrar sessão', 'Encerrando…')}
        </button>
      </div>

      <QRModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConnected={() => {
          void refetchStatus();
        }}
      />
    </div>
  );
}
