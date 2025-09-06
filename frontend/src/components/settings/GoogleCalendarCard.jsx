import React, { useEffect, useState } from 'react';
import { gcal } from 'api/integrations.service';

export default function GoogleCalendarCard({ refresh }) {
  const [status, setStatus] = useState('disconnected');
  const [calendars, setCalendars] = useState([]);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    const { data } = await gcal.status();
    setStatus(data?.status || 'disconnected');
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
      setCalendars(Array.isArray(cals?.items) ? cals.items : []);
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
          <button className="btn btn-primary" onClick={connect}>Conectar Google</button>
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
