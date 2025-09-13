import React, { useEffect, useState } from 'react';
import inboxApi from '../api/inboxApi';
import { useOrg } from '../contexts/OrgContext.jsx';
import FeatureGate from '../ui/feature/FeatureGate';

function CalendarPageInner() {
  const { selected } = useOrg();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState('');
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle');

  // load accounts
  useEffect(() => {
    if (!selected) return;
    inboxApi.get(`/orgs/${selected}/calendar/accounts`, { meta: { scope: 'global' } })
      .then(r => {
        const list = r.data || [];
        setAccounts(list);
        if (list[0]?.id) setAccountId(list[0].id);
      })
      .catch(() => setStatus('error'));
  }, [selected]);

  // load calendars when account changes
  useEffect(() => {
    if (!accountId) return;
    setStatus('loading');
    inboxApi.get(`/orgs/${selected}/calendar/accounts/${accountId}/calendars`)
      .then(r => {
        const items = r.data?.items || [];
        setCalendars(items);
        if (items[0]?.id) setCalendarId(items[0].id);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [accountId, selected]);

  // load events when calendar changes
  useEffect(() => {
    if (!calendarId) return;
    setStatus('loading');
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    inboxApi.get(`/orgs/${selected}/calendar/accounts/${accountId}/events`, { params: { calendarId, from, to } })
      .then(r => {
        setEvents(r.data?.items || []);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [calendarId, selected, accountId]);

  if (status === 'error') {
    return <div className="p-6">Erro ao carregar.</div>;
  }

  return (
    <div className="p-6" data-testid="calendar-page">
      <h1 className="text-2xl font-semibold mb-4">Calendário</h1>
      <div className="mb-4 flex gap-2">
        <select
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.display_name || a.email || a.google_user_id}</option>
          ))}
        </select>
        <select
          value={calendarId}
          onChange={e => setCalendarId(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          {calendars.map(c => (
            <option key={c.id} value={c.id}>{c.summary}</option>
          ))}
        </select>
      </div>
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
                {formatDate(ev.start?.dateTime)} - {formatDate(ev.end?.dateTime)}
                {ev.location ? ` @ ${ev.location}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(dt) {
  return dt ? new Date(dt).toLocaleString() : '';
}

export default function CalendarPage() {
  return (
    <FeatureGate code="google_calendar_accounts" fallback={null}>
      <CalendarPageInner />
    </FeatureGate>
  );
}
