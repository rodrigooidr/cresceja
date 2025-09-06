import React, { useState } from 'react';
import inboxApi from '../../api/inboxApi';
import ChannelCard from './ChannelCard';

function Badge({ state }) {
  const map = {
    green: 'bg-green-600 text-white',
    yellow: 'bg-amber-500 text-white',
    red: 'bg-red-600 text-white',
  };
  const cls = map[state] || map.red;
  const icon = state === 'green' ? '🟢' : state === 'yellow' ? '🟡' : '🔴';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {icon}
    </span>
  );
}

export default function WhatsAppOfficialCard({ data, refresh }) {
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [tests, setTests] = useState([]);

  async function handleConnect(e) {
    e.preventDefault();
    await inboxApi.post('/integrations/whatsapp/cloud/connect', {
      phone_number_id: phone,
      token,
    });
    setPhone('');
    setToken('');
    refresh();
  }

  async function handleDisconnect() {
    await inboxApi.post('/integrations/whatsapp/cloud/disconnect');
    refresh();
  }

  async function verify() {
    const res = [];
    try {
      const { data: s } = await inboxApi.get('/integrations/whatsapp/cloud/status');
      const st = s.status === 'connected' ? 'green' : s.status === 'connecting' ? 'yellow' : 'red';
      res.push({ label: 'Token/ID', state: st });
    } catch {
      res.push({ label: 'Token/ID', state: 'red' });
    }
    try {
      const { data: w } = await inboxApi.get('/integrations/whatsapp/cloud/webhook-check');
      res.push({ label: 'Webhook', state: w.verified ? 'green' : 'yellow' });
    } catch {
      res.push({ label: 'Webhook', state: 'red' });
    }
    setTests(res);
  }

  return (
    <ChannelCard title="WhatsApp Oficial" testId="card-wa-official">
      {data.status === 'connected' ? (
        <div className="flex items-center justify-between">
          <div>Conectado{data.phone_number_id ? ` (${data.phone_number_id})` : ''}</div>
          <button
            className="px-3 py-1 bg-red-600 text-white"
            onClick={handleDisconnect}
          >
            Desconectar
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number ID"
            className="border p-1 w-full"
          />
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Access Token"
            className="border p-1 w-full"
          />
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white">
            Conectar
          </button>
        </form>
      )}

      <div className="mt-4">
        <button
          className="px-3 py-1 bg-gray-100"
          onClick={verify}
        >
          Verificar Conectividade
        </button>
      </div>

      {tests.length > 0 && (
        <ul className="mt-2">
          {tests.map((t) => (
            <li key={t.label} className="flex items-center gap-2 text-sm mb-1">
              <span>{t.label}</span>
              <Badge state={t.state} />
            </li>
          ))}
        </ul>
      )}
    </ChannelCard>
  );
}
