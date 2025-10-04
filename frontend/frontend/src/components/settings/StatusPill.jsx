import React from 'react';
import { getIntegrationDictionary } from '@/i18n/integrations.js';

const messages = getIntegrationDictionary();
const statusLabels = messages.status || {};

const STATUS_MAP = {
  connected: {
    label: statusLabels.connected || 'Conectado',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  disconnected: {
    label: statusLabels.disconnected || 'Desconectado',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  pending: {
    label: statusLabels.pending || 'Pendente',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  connecting: {
    label: statusLabels.connecting || 'Conectando…',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  error: {
    label: statusLabels.error || 'Erro',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  unknown: {
    label: statusLabels.unknown || 'Indefinido',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
};

export default function StatusPill({ status }) {
  const normalized = typeof status === 'string' ? status.toLowerCase() : 'unknown';
  const meta = STATUS_MAP[normalized] || STATUS_MAP.unknown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" aria-hidden />
      {meta.label}
    </span>
  );
}
