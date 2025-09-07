import React, { useEffect, useState } from 'react';
import { waCloud } from 'api/integrations.service';

export default function WhatsAppOfficialCard({ data = {}, refresh }) {
  const [phoneId, setPhoneId] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(data?.status || 'disconnected');
  const [checking, setChecking] = useState(false);

  useEffect(() => { refresh?.(); }, [refresh]);

  useEffect(() => {
    setStatus(data?.status || 'disconnected');
  }, [data]);

  const disabledConnect = !phoneId.trim() || !token.trim();

  async function connect() {
    try {
      await waCloud.connect({ phone_number_id: phoneId, token });
      await refresh?.();
    } catch (e) {
      console.error(e);
    }
  }

  async function checkConnectivity() {
    setChecking(true);
    try {
      await waCloud.webhookCheck();
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mb-6 border rounded p-4 bg-white">
      <div className="font-medium mb-2">WhatsApp Oficial</div>
      <input
        className="w-full border rounded px-3 py-2 mb-2"
        placeholder="Phone Number ID"
        value={phoneId}
        onChange={(e) => setPhoneId(e.target.value)}
      />
      <input
        className="w-full border rounded px-3 py-2 mb-3"
        placeholder="Access Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-2 rounded text-white ${disabledConnect ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={connect}
          disabled={disabledConnect}
        >
          Conectar
        </button>
        <button
          className={`px-3 py-2 rounded border ${checking ? 'opacity-60 cursor-not-allowed' : ''}`}
          onClick={checkConnectivity}
          disabled={checking || disabledConnect}
          title={disabledConnect ? 'Preencha Phone Number ID e Access Token' : ''}
        >
          Verificar Conectividade
        </button>
        <span className={`ml-auto text-xs px-2 py-1 rounded ${status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

