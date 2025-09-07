import React, { useEffect, useState } from 'react';
import { waSession } from 'api/integrations.service';

export default function WhatsAppBaileysCard({ data = {}, refresh }) {
  const [status, setStatus] = useState(data?.status || 'disconnected');

  useEffect(() => { refresh?.(); }, [refresh]);
  useEffect(() => setStatus(data?.status || 'disconnected'), [data]);

  const canStart = status === 'disconnected' || status === 'error';
  const canShowQR = status === 'connecting' || status === 'qr';
  const canTest = status === 'connected';

  const start = async () => { try { await waSession.start(); await refresh?.(); } catch (e) { console.error(e);} };
  const logout = async () => { try { await waSession.logout(); await refresh?.(); } catch (e) { console.error(e);} };
  const test = async () => { try { await waSession.test(); } catch (e) { console.error(e);} };

  return (
    <div className="mb-6 border rounded p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <div className="font-medium">WhatsApp (Baileys)</div>
        <span className={`ml-auto text-xs px-2 py-1 rounded ${status === 'connected' ? 'bg-green-100 text-green-700' : status === 'connecting' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
          {status}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button className={`underline ${!canStart && 'opacity-50 pointer-events-none'}`} disabled={!canStart} onClick={start}>Iniciar sessão</button>
        <button className={`underline ${!canShowQR && 'opacity-50 pointer-events-none'}`} disabled={!canShowQR} onClick={() => window.dispatchEvent(new CustomEvent('wa:showQR'))}>Mostrar QR</button>
        <button className="underline" onClick={logout}>Desconectar</button>
        <button className={`underline ${!canTest && 'opacity-50 pointer-events-none'}`} disabled={!canTest} onClick={test}>Testar</button>
      </div>
    </div>
  );
}

