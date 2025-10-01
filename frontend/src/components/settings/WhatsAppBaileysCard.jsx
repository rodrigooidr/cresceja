import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getProviderStatus,
  connectProvider,
  testProvider,
  disconnectProvider,
  startBaileysQr,
  stopBaileysQr,
  statusBaileys,
} from '@/api/integrationsApi.js';
import inboxApi from '@/api/inboxApi.js';
import useToast from '@/hooks/useToastFallback.js';
import { useOrg } from '@/contexts/OrgContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import StatusPill from './StatusPill.jsx';
import InlineSpinner from '../InlineSpinner.jsx';
import { getToastMessages, resolveIntegrationError } from './integrationMessages.js';

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
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);
  const eventSourceRef = useRef(null);
  const defaultGateMessage = 'Recurso liberado somente por Suporte/SuperAdmin.';
  const cleanupStream = useCallback(() => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (_) {}
      eventSourceRef.current = null;
    }
  }, []);
  const closeQrModal = useCallback(
    (shouldStop = true) => {
      cleanupStream();
      setQrModalOpen(false);
      setQrData(null);
      setQrError(null);
      if (shouldStop) {
        stopBaileysQr().catch(() => {});
      }
    },
    [cleanupStream]
  );

  const canTest = useMemo(() => Boolean(testTo.trim()), [testTo]);
  const testOnlyEmail = state.meta?.test_only_email || null;
  const restricted = Boolean(testOnlyEmail && user?.email && user.email !== testOnlyEmail);

  const getErrorMessage = (error, fallbackKey) => resolveIntegrationError(error, fallbackKey);

  const applyIntegration = (integration) => {
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
          lastError: getErrorMessage(err, 'load_status'),
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [org?.id]);

  useEffect(
    () => () => {
      cleanupStream();
      if (qrModalOpen) {
        stopBaileysQr().catch(() => {});
      }
    },
    [cleanupStream, qrModalOpen]
  );

  useEffect(() => {
    if (!qrModalOpen) {
      cleanupStream();
      return undefined;
    }

    setQrError(null);
    setQrData(null);

    try {
      const es = new EventSource('/api/integrations/providers/whatsapp_session/qr/stream', {
        withCredentials: true,
      });
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        if (!event?.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'qr' && payload.qr) {
            setQrData(payload.qr);
            setQrError(null);
          }
          if (payload.type === 'status' && payload.status) {
            setState((prev) => ({
              ...prev,
              status: payload.status,
              meta: { ...prev.meta, session_state: payload.status },
            }));
            if (payload.status === 'connected') {
              closeQrModal();
            }
          }
        } catch (_) {}
      };
      es.onerror = () => {
        setQrError('Conexão com o stream perdida. Gere um novo QR.');
      };
    } catch (err) {
      setQrError('Não foi possível abrir o stream de QR.');
    }

    return () => {
      cleanupStream();
    };
  }, [qrModalOpen, cleanupStream, closeQrModal]);

  const handleConnect = async () => {
    setState((prev) => ({ ...prev, saving: true, lastError: null }));
    try {
      const response = await connectProvider('whatsapp_session', {
        session_host: sessionHost || undefined,
      });
      const integration = response?.integration || response;
      applyIntegration(integration);
      setState((prev) => ({ ...prev, saving: false }));
      toast({ title: toastMessages.connect_success || 'Sessão WhatsApp iniciada', description: org?.name });
    } catch (err) {
      const message = getErrorMessage(err, 'connect');
      setState((prev) => ({
        ...prev,
        saving: false,
        status: 'error',
        lastError: message,
      }));
      toast({ title: toastMessages.connect_error || 'Erro ao iniciar sessão', description: message });
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

  const handleStartQr = async () => {
    if (featuresGate.loading || !featuresGate.enabled) {
      return;
    }
    setQrLoading(true);
    setQrError(null);
    try {
      await startBaileysQr();
      cleanupStream();
      setQrData(null);
      setState((prev) => ({
        ...prev,
        status: 'pending_qr',
        meta: { ...prev.meta, session_state: 'pending_qr' },
      }));
      setQrModalOpen(true);
    } catch (err) {
      const message = err?.response?.data?.message || 'Não foi possível gerar o QR Code.';
      if (err?.response?.status === 403) {
        setFeaturesGate({ loading: false, enabled: false, message: message || defaultGateMessage });
      }
      setQrError(message);
      toast({ title: 'Erro ao gerar QR', description: message });
    } finally {
      setQrLoading(false);
    }
  };

  const handleStopQr = async () => {
    try {
      await stopBaileysQr();
    } catch (err) {
      const message = err?.response?.data?.message || 'Não foi possível interromper o QR Code.';
      toast({ title: 'Erro ao parar QR', description: message });
    } finally {
      closeQrModal(false);
    }
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
  const qrButtonDisabled =
    featuresGate.loading || !featuresGate.enabled || qrLoading || restricted;
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
            onClick={handleStartQr}
            disabled={qrButtonDisabled}
            aria-busy={qrLoading}
            title={gateTooltip || undefined}
            data-testid="whatsapp-session-qr-button"
          >
            {renderActionLabel(qrLoading, 'Gerar QR', 'Gerando…')}
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
      {qrModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="whatsapp-session-qr-modal"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">Escaneie o QR Code</h4>
              <button
                type="button"
                className="text-sm text-gray-500 transition hover:text-gray-700"
                onClick={() => closeQrModal()}
              >
                Fechar
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              {qrData?.dataUrl ? (
                <img
                  src={qrData.dataUrl}
                  alt="QR Code para autenticação do WhatsApp"
                  className="h-56 w-56 rounded-lg border"
                  data-testid="whatsapp-session-qr-image"
                />
              ) : (
                <div
                  className="flex h-56 w-56 items-center justify-center rounded-lg border bg-gray-50 text-sm text-gray-500"
                  data-testid="whatsapp-session-qr-placeholder"
                >
                  {qrError || 'Aguardando QR Code…'}
                </div>
              )}
              <p className="text-sm text-gray-600" data-testid="whatsapp-session-qr-status">
                {qrStatusLabel}
              </p>
            </div>
            {qrError && qrData?.dataUrl ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {qrError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
                onClick={() => closeQrModal()}
              >
                Fechar
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                onClick={handleStopQr}
                data-testid="whatsapp-session-qr-stop"
              >
                Parar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
