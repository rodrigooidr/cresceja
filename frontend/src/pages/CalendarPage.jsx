import React, { useEffect, useState } from 'react';
import inboxApi from '../api/inboxApi';
import { useOrg } from '../contexts/OrgContext.jsx';
import FeatureGate from '../ui/feature/FeatureGate';
import FormField from '../ui/form/FormField.jsx';

function CalendarPageInner() {
  const { selected } = useOrg();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState('');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date(Date.now()+30*24*3600*1000).toISOString().slice(0,10));
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!selected) return;
    inboxApi.get(`/orgs/${selected}/calendar/accounts`, { meta:{ scope:'global' } })
      .then(r => {
        const list = r.data || [];
        setAccounts(list);
        if (list[0]?.id) setAccountId(list[0].id);
      })
      .catch(() => setStatus('error'));
  }, [selected]);

  useEffect(() => {
    if (!accountId) return;
    setStatus('loading');
    inboxApi.get(`/orgs/${selected}/calendar/accounts/${accountId}/calendars`)
      .then(r => {
        const items = r.data || [];
        setCalendars(items);
        if (items[0]?.id) setCalendarId(items[0].id);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [accountId, selected]);

  async function handleLoad() {
    const errs = {};
    if (!calendarId) errs.calendarId = { message: 'Obrigatório' };
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStatus('loading');
    try {
      const { data } = await inboxApi.get(`/orgs/${selected}/calendar/accounts/${accountId}/events`, {
        params: { calendarId, from, to }
      });
      setEvents(data || []);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'error') {
    return <div className="p-6">Erro ao carregar.</div>;
  }

  return (
    <div className="p-6" data-testid="calendar-page">
      <h1 className="text-2xl font-semibold mb-4">Calendário</h1>
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Conta" name="accountId">
          <select value={accountId} onChange={e=>setAccountId(e.target.value)} className="border px-2 py-1 rounded w-full">
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.display_name || a.email || a.google_user_id}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Calendário" name="calendarId" error={errors.calendarId}>
          <select value={calendarId} onChange={e=>setCalendarId(e.target.value)} className="border px-2 py-1 rounded w-full" data-testid="calendar-select">
            <option value="">Selecione…</option>
            {calendars.map(c => (
              <option key={c.id} value={c.id}>{c.summary}</option>
            ))}
          </select>
        </FormField>
        <FormField label="De" name="from">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border px-2 py-1 rounded w-full" />
        </FormField>
        <FormField label="Até" name="to">
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border px-2 py-1 rounded w-full" />
        </FormField>
      </div>
      <button className="btn btn-primary mb-4" onClick={handleLoad}>Carregar eventos</button>
      {status === 'loading' ? (
        <div>Carregando...</div>
      ) : events.length === 0 ? (
        <div className="text-sm text-gray-500">Nenhum evento.</div>
      ) : (
        <ul className="space-y-2">
          {events.map(ev => (
            <li key={ev.id} className="border rounded p-2">
              <div className="font-medium">{ev.summary || '(Sem título)'}</div>
              <div className="text-sm opacity-75">
                {formatDate(ev.start)} - {formatDate(ev.end)}{ev.location ? ` @ ${ev.location}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(dt) {
  if (!dt) return '';
  const optsBase = { timeZone: 'America/Sao_Paulo' };
  if (typeof dt === 'string' && !dt.includes('T')) {
    const [y, m, d] = dt.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('pt-BR', { ...optsBase, dateStyle: 'short' }).format(date);
  }
  const date = new Date(dt);
  return new Intl.DateTimeFormat('pt-BR', { ...optsBase, dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function CalendarPage() {
  return (
    <FeatureGate code="google_calendar_accounts" fallback={null}>
      <CalendarPageInner />
    </FeatureGate>
  );
}
