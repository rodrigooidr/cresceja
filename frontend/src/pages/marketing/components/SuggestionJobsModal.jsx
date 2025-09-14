import React, { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { useApi } from '../../../contexts/useApi.js';
import useToastFallback from '../../../hooks/useToastFallback.js';
import { mapApiErrorToForm } from '../../../ui/errors/mapApiError.js';

export default function SuggestionJobsModal({ orgId, suggestionId, onClose, onChanged }) {
  const api = useApi();
  const toast = useToastFallback();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState(null);
  const [when, setWhen] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`/orgs/${orgId}/suggestions/${suggestionId}/jobs`);
      setJobs(r.data || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId, suggestionId]);

  async function cancelJob(kind, jobId) {
    try {
      const path = kind === 'ig' ? `/orgs/${orgId}/instagram/jobs/${jobId}` : `/orgs/${orgId}/facebook/jobs/${jobId}`;
      await api.patch(path, { action: 'cancel' });
      toast({ title: `${kind.toUpperCase()} cancelado` });
      await load();
      onChanged?.();
    } catch (e) {
      const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao cancelar';
      toast({ title: msg, status: 'error' });
    }
  }

  async function rescheduleJob(kind, jobId) {
    try {
      const zoned = DateTime.fromISO(when, { setZone: true });
      if (!zoned.isValid) {
        toast({ title: 'Data/hora inválida', status: 'error' });
        return;
      }
      const scheduleAt = zoned.toUTC().toISO();
      const path = kind === 'ig' ? `/orgs/${orgId}/instagram/jobs/${jobId}` : `/orgs/${orgId}/facebook/jobs/${jobId}`;
      await api.patch(path, { action: 'reschedule', scheduleAt });
      toast({ title: `${kind.toUpperCase()} reagendado` });
      await load();
      onChanged?.();
    } catch (e) {
      const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao reagendar';
      toast({ title: msg, status: 'error' });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 w-[520px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Jobs da Sugestão</h3>
          <button onClick={onClose} className="text-sm underline">Fechar</button>
        </div>

        {loading ? (
          <div>Carregando…</div>
        ) : (
          <div className="space-y-3">
            {['ig','fb'].map((kind) => {
              const row = jobs?.[kind] || {};
              if (!row.jobId) {
                return (
                  <div key={kind} className="border rounded p-2 opacity-60">
                    <div className="text-sm font-medium">{kind.toUpperCase()}</div>
                    <div className="text-xs">Sem job criado</div>
                  </div>
                );
              }
              const pending = ['pending','creating','publishing','scheduled'].includes(row.status);
              return (
                <div key={kind} className="border rounded p-2">
                  <div className="text-sm font-medium">{kind.toUpperCase()}</div>
                  <div className="text-xs mb-2">Status: <b>{row.status}</b></div>
                  {pending ? (
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => cancelJob(kind, row.jobId)}>Cancelar</button>
                      <input type="datetime-local" className="border rounded px-2 py-1" value={when} onChange={e => setWhen(e.target.value)} />
                      <button className="px-2 py-1 border rounded" onClick={() => rescheduleJob(kind, row.jobId)}>Reagendar</button>
                    </div>
                  ) : (
                    <div className="text-xs opacity-70">Edição indisponível — job finalizado</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
