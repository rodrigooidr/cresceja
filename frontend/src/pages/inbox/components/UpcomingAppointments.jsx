import React, { useState } from 'react';
import inboxApi from '@/api/inboxApi';

const readEnv = (viteKey, craKey, fallback) => {
  const fromVite = (typeof import !== 'undefined' && import.meta && import.meta.env)
    ? import.meta.env[viteKey]
    : undefined;
  const fromCRA = (typeof process !== 'undefined' && process.env)
    ? process.env[craKey]
    : undefined;
  const fromWindow = (typeof window !== 'undefined' && window.ENV)
    ? window.ENV[viteKey]
    : undefined;
  return fromVite ?? fromCRA ?? fromWindow ?? fallback;
};

const DEDUP_MIN = Number(
  readEnv('VITE_REMIND_DEDUP_WINDOW_MIN', 'REACT_APP_REMIND_DEDUP_WINDOW_MIN', 15)
);

export default function UpcomingAppointments({ items = [] }) {
  const [busyId, setBusyId] = useState(null);
  const [cooldown, setCooldown] = useState({}); // { [eventId]: untilTs }

  const now = Date.now();

  const canSend = (id) => {
    const until = cooldown[id];
    return !until || now > until;
  };

  async function sendRemind(ev) {
    if (!canSend(ev.id)) return;
    setBusyId(ev.id);
    try {
      const { data } = await inboxApi.post(`/calendar/events/${ev.id}/remind`, {
        to: ev.customer?.whatsapp || ev.customer?.phone,
        channel: 'whatsapp',
        text: ev.remindText || 'Lembrete do seu agendamento.'
      });
      // se idempotent:false ou true, sempre inicia cooldown
      const until = Date.now() + DEDUP_MIN * 60 * 1000;
      setCooldown((m) => ({ ...m, [ev.id]: until }));
      window.toast?.({ title: data.idempotent ? 'Já enviado recentemente' : 'Lembrete enviado!' });
    } catch (e) {
      if (e?.response?.status === 429) {
        window.toast?.({ title: 'Muitos pedidos. Tente de novo em até 60s.' });
      } else if (e?.response?.status === 424) {
        window.toast?.({ title: 'WhatsApp não configurado. Configure nas integrações.' });
      } else {
        window.toast?.({ title: 'Falha ao enviar lembrete.' });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      {items.map((ev) => {
        const disabled = busyId === ev.id || !canSend(ev.id);
        const until = cooldown[ev.id];
        const tooltip = until ? `Aguarde ${Math.ceil((until - Date.now())/60000)} min para reenviar` : 'Enviar lembrete';
        return (
          <div key={ev.id} className="border rounded p-2 flex items-center justify-between">
            <div>
              <div className="font-medium">{ev.title}</div>
              <div className="text-xs opacity-70">{new Date(ev.start_at).toLocaleString()}</div>
            </div>
            <button
              className={`px-3 py-1 border rounded ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => sendRemind(ev)} disabled={disabled} title={tooltip}
            >
              {busyId === ev.id ? 'Enviando...' : (until ? 'Aguardando...' : 'Enviar lembrete')}
            </button>
          </div>
        );
      })}
      {items.length === 0 && <div className="text-sm opacity-70">Sem agendamentos.</div>}
    </div>
  );
}
