import React, { useEffect, useMemo, useState } from 'react';
import { listEvents } from '@/api/integrationsApi.js';
import useToast from '@/hooks/useToastFallback.js';
import InlineSpinner from '@/components/InlineSpinner.jsx';
import { getIntegrationDictionary, translateIntegration } from '@/i18n/integrations.js';

const LIMIT = 20;
const dictionary = getIntegrationDictionary();
const eventMessages = dictionary.events || {};
const toastMessages = dictionary.toasts?.events || {};
const errorMessages = dictionary.errors || {};

const PROVIDER_OPTIONS = [
  { value: '', label: eventMessages.provider_all || 'Todos os provedores' },
  { value: 'whatsapp_cloud', label: 'WhatsApp Cloud' },
  { value: 'whatsapp_session', label: 'WhatsApp Sessão' },
  { value: 'meta_instagram', label: 'Instagram' },
  { value: 'meta_facebook', label: 'Facebook' },
  { value: 'google_calendar', label: 'Google Calendar' },
];

const PERIOD_OPTIONS = [
  {
    value: '24h',
    label: eventMessages.period_last_24h || 'Últimas 24h',
    range: () => [new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()],
  },
  {
    value: '7d',
    label: eventMessages.period_last_7d || 'Últimos 7 dias',
    range: () => [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()],
  },
  {
    value: '30d',
    label: eventMessages.period_last_30d || 'Últimos 30 dias',
    range: () => [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()],
  },
  {
    value: 'all',
    label: eventMessages.period_all || 'Todo o período',
    range: () => [null, null],
  },
];

const providerLabelMap = PROVIDER_OPTIONS.reduce((acc, option) => {
  if (option.value) acc[option.value] = option.label;
  return acc;
}, {});

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function getRange(period) {
  const option = PERIOD_OPTIONS.find((item) => item.value === period) || PERIOD_OPTIONS[1];
  const [start, end] = option.range();
  return {
    start: start ? start.toISOString() : undefined,
    end: end ? end.toISOString() : undefined,
  };
}

function buildPaginationLabel({ page, total, count }) {
  const start = total === 0 ? 0 : page * LIMIT + 1;
  const end = total === 0 ? 0 : page * LIMIT + count;
  return (
    translateIntegration('pagination.showing', {
      fallback: `Mostrando ${start}-${end} de ${total}`,
      vars: { start, end, total },
    }) || ''
  );
}

const genericErrorMessage = errorMessages.generic || 'Falha ao completar a ação. Tente novamente.';

export default function IntegrationEvents() {
  const toast = useToast();
  const [provider, setProvider] = useState('');
  const [period, setPeriod] = useState('7d');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const { start, end } = useMemo(() => getRange(period), [period]);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      setLoading(true);
      setError(null);
      try {
        const response = await listEvents({
          provider: provider || undefined,
          limit: LIMIT,
          offset: page * LIMIT,
          start,
          end,
        });
        if (cancelled) return;
        setItems(Array.isArray(response?.items) ? response.items : []);
        setTotal(Number(response?.total) || 0);
      } catch (err) {
        if (cancelled) return;
        const message =
          err?.response?.data?.message || err?.message || toastMessages.load_error || genericErrorMessage;
        setItems([]);
        setTotal(0);
        setError(message);
        toast({ title: toastMessages.load_error || eventMessages.title || 'Eventos de Integrações', description: message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [provider, period, page, start, end, toast]);

  const hasNextPage = (page + 1) * LIMIT < total;
  const paginationLabel = buildPaginationLabel({ page, total, count: items.length });

  const handleProviderChange = (event) => {
    setProvider(event.target.value);
    setPage(0);
  };

  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
    setPage(0);
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-4" data-testid="integration-events">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{eventMessages.title || 'Eventos de Integrações'}</h2>
        <p className="text-sm text-gray-500">
          {provider ? providerLabelMap[provider] || provider : eventMessages.provider_all || 'Todos os provedores'}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4" data-testid="integration-events-filters">
        <label className="grid gap-1 text-sm" htmlFor="integration-events-provider">
          <span className="font-medium">{eventMessages.provider || 'Provedor'}</span>
          <select
            id="integration-events-provider"
            className="rounded-lg border px-3 py-2"
            value={provider}
            onChange={handleProviderChange}
            disabled={loading}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm" htmlFor="integration-events-period">
          <span className="font-medium">Período</span>
          <select
            id="integration-events-period"
            className="rounded-lg border px-3 py-2"
            value={period}
            onChange={handlePeriodChange}
            disabled={loading}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {error ? String(error) : ''}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="integration-events-error">
          {String(error)}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="relative">
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-8" data-testid="integration-events-loading">
              <InlineSpinner />
              <span className="text-sm text-gray-500">{eventMessages.loading || 'Carregando eventos…'}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500" data-testid="integration-events-empty">
              {eventMessages.empty || 'Nenhum evento encontrado no período selecionado.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm" data-testid="integration-events-table">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      {eventMessages.received_at || 'Recebido em'}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {eventMessages.provider || 'Provedor'}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {eventMessages.event_type || 'Tipo de evento'}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {eventMessages.summary || 'Resumo'}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      {eventMessages.actions || 'Ações'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(item.received_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {providerLabelMap[item.provider] || item.provider || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {item.event_type || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.summary || (eventMessages.summary || 'Evento recebido')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                          onClick={() => setSelectedEvent(item)}
                        >
                          {eventMessages.view_json || 'Ver JSON'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="integration-events-pagination">
        <p className="text-sm text-gray-500">{paginationLabel}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-1 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handlePrevPage}
            disabled={loading || page === 0}
          >
            {translateIntegration('pagination.previous', { fallback: 'Anterior' })}
          </button>
          <button
            type="button"
            className="rounded-lg border px-3 py-1 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleNextPage}
            disabled={loading || !hasNextPage}
          >
            {translateIntegration('pagination.next', { fallback: 'Próximo' })}
          </button>
        </div>
      </div>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">{eventMessages.modal_title || 'Detalhes do evento'}</h3>
              <button
                type="button"
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
                onClick={() => setSelectedEvent(null)}
                aria-label={eventMessages.close || 'Fechar'}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-4 py-3 text-sm">
              <pre className="whitespace-pre-wrap break-all text-xs text-gray-700">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
