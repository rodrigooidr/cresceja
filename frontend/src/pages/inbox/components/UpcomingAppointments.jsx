import React, { useEffect, useMemo, useState } from 'react';

/**
 * Props:
 * - contactId: uuid do contato (obrigatório)
 * - onReschedule: (event) => void   // abrir ScheduleModal pré-preenchido
 * - onChanged?: () => void          // opcional: recarregar pai após cancelamento
 */
export default function UpcomingAppointments({ contactId, onReschedule, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fromISO = useMemo(() => new Date().toISOString(), []);
  const toISO   = useMemo(() => new Date(Date.now() + 30*24*3600*1000).toISOString(), []);

  async function load() {
    setLoading(true); setErr('');
    try {
      const u = new URL('/api/calendar/events', window.location.origin);
      u.searchParams.set('contactId', contactId);
      u.searchParams.set('from', fromISO);
      u.searchParams.set('to', toISO);
      const r = await fetch(u.toString());
      const js = await r.json();
      setItems(js.items || []);
    } catch(e) {
      setErr('Falha ao carregar agendamentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (contactId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  async function cancel(ev) {
    if (!window.confirm('Cancelar este agendamento?')) return;
    try {
      const u = new URL(`/api/calendar/events/${encodeURIComponent(ev.external_event_id)}`, window.location.origin);
      // calendarId pode vir do normalizer como organizer email; se não houver, backend ignora
      if (ev.calendar_id) u.searchParams.set('calendarId', ev.calendar_id);
      const r = await fetch(u.toString(), { method: 'DELETE' });
      if (!r.ok) throw new Error('cancel failed');
      await load();
      onChanged?.();
    } catch(e) {
      alert('Falha ao cancelar.');
    }
  }

  async function remind(ev) {
    try {
      const r = await fetch('/api/calendar/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: 0.25 }),
      });
      if (!r.ok) throw new Error('failed');
      alert('Lembrete disparado.');
      await load();
    } catch (e) {
      alert('Falha ao enviar lembrete.');
    }
  }

  if (!contactId) return null;

  return (
    <div aria-label="upcoming-appointments" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Próximos agendamentos</div>
      {loading && <div>Carregando…</div>}
      {err && <div style={{ color:'#b91c1c' }}>{err}</div>}
      {!loading && !err && items.length === 0 && (
        <div style={{ opacity:.7 }}>Nenhum agendamento nos próximos 30 dias.</div>
      )}
      {!loading && items.length > 0 && (
        <ul style={{ listStyle:'none', padding: 0, margin: 0, display:'grid', gap: 8 }}>
          {items.map((ev) => (
            <li key={ev.id} style={{ border:'1px solid #eee', borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 600 }}>{ev.summary || 'Atendimento'}</div>
              <div style={{ fontSize: 13, opacity:.85 }}>
                {new Date(ev.start_at).toLocaleString()} → {new Date(ev.end_at).toLocaleTimeString()}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background:
                      ev.rsvp_status === 'confirmed'
                        ? '#DCFCE7'
                        : ev.rsvp_status === 'canceled'
                        ? '#FEE2E2'
                        : ev.rsvp_status === 'noshow'
                        ? '#FFE4E6'
                        : '#E5E7EB',
                  }}
                >
                  {ev.rsvp_status || 'pending'}
                </span>
                <button onClick={() => onReschedule?.(ev)} style={{ border:'1px solid #ddd', borderRadius:6, padding:'4px 8px' }}>
                  Remarcar
                </button>
                <button
                  onClick={() => remind(ev)}
                  style={{ border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px' }}
                >
                  Lembrar agora
                </button>
                <button onClick={() => cancel(ev)} style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px' }}>
                  Cancelar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
