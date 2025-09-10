import React, { useEffect, useState } from 'react';
import { gcal } from 'api/integrations.service';

const canConnect = (allowed, current) =>
  typeof allowed === 'number' && (allowed < 0 || current < allowed);

export default function GoogleCalendarCard({ refresh }) {
  const [status, setStatus] = useState('disconnected');
  const [calendars, setCalendars] = useState([]);
  const [testing, setTesting] = useState(false);
  const [limit, setLimit] = useState(0);
  const [count, setCount] = useState(0);

  const load = async () => {
    const { data } = await gcal.status();
    setStatus(data?.status || 'disconnected');
    setLimit(data?.limit ?? 0);
    setCount(data?.count ?? 0);
  };
  useEffect(() => { load(); }, []);

  const connect = async () => {
    const { data } = await gcal.oauthStart();
    if (data?.url) window.location.href = data.url;
  };

  const test = async () => {
    setTesting(true);
    try {
      const [{ data: st }, { data: cals }] = await Promise.all([
        gcal.status(),
        gcal.calendars(),
      ]);
      setStatus(st?.status || 'disconnected');
      setLimit(st?.limit ?? 0);
      const items = Array.isArray(cals?.items) ? cals.items : [];
      setCalendars(items);
      setCount(items.length);
    } finally { setTesting(false); }
  };

  const createTestEvent = async () => {
    await gcal.events({ summary: 'Teste CresceJá' });
    await test();
  };

  return (
    <div className="border rounded-xl p-4 bg-white mt-4">
      <h3 className="font-semibold text-sm mb-2">Google Calendar</h3>
      <div className="mt-2 flex gap-2">
        {status !== 'connected' ? (
          <button
            className={`btn btn-primary ${!canConnect(limit, count) ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={connect}
            disabled={!canConnect(limit, count)}
            title={!canConnect(limit, count) ? `Seu plano permite ${limit < 0 ? 'ilimitados' : limit} calendários` : ''}
          >
            Conectar Google
          </button>
        ) : (
          <button className="btn" onClick={createTestEvent}>Criar evento teste</button>
        )}
        <button className="btn" onClick={test} disabled={testing}>Testar</button>
      </div>
      <ul className="mt-2 text-sm">
        <li className="flex justify-between">Status
          <span className={`inline-flex px-2 py-0.5 rounded-md ${status==='connected'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>{status}</span>
        </li>
        <li className="flex justify-between">Calendários
          <span className={`inline-flex px-2 py-0.5 rounded-md ${calendars.length>0?'bg-green-600 text-white':'bg-amber-500 text-white'}`}>
            {calendars.length>0?'OK':'Pendente'}
          </span>
        </li>
      </ul>
    </div>
  );
}
