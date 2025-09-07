import React, { useEffect, useRef, useState } from 'react';
import { waSession } from 'api/integrations.service';
import { io } from 'socket.io-client';
import PopoverPortal from 'ui/PopoverPortal';

export default function WhatsAppBaileysCard({ orgId, currentOrg, disabled }) {
  const [status, setStatus] = useState('disconnected');
  const [testing, setTesting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState('');
  const qrBtnRef = useRef(null);

  const refresh = async () => {
    try {
      const { data } = await waSession.status({ orgId });
      setStatus(data?.status || 'disconnected');
    } catch {
      setStatus('disconnected');
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  useEffect(() => {
    const s = io('/', { path: '/socket.io', withCredentials: true, auth: {} });
    s.on('wa:session:qr', ({ qr }) => setQr(qr));
    s.on('wa:session:status', ({ status }) => setStatus(status));
    return () => { s.off('wa:session:qr'); s.off('wa:session:status'); s.disconnect(); };
  }, []);

  const start = async () => {
    await waSession.start({ orgId });
    setQrOpen(true);
  };
  const logout = async () => {
    await waSession.logout({ orgId });
    refresh();
  };
  const test = async () => {
    setTesting(true);
    try {
      const { data } = await waSession.test({ orgId });
      setStatus(data?.status || status);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">WhatsApp (Baileys)</h3>
        <span className={`inline-flex px-2 py-0.5 rounded-md ${status === 'connected' ? 'bg-green-600 text-white' : status === 'connecting' ? 'bg-amber-500 text-white' : status === 'error' ? 'bg-red-600 text-white' : 'bg-gray-300 text-gray-800'}`}>{status}</span>
      </div>

      {disabled ? (
        <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
          O modo sessão (QR) está desabilitado para este ambiente.
        </div>
      ) : (
        <>
          <div className="mt-2 flex gap-2">
            <button className="btn btn-primary" onClick={start}>Iniciar sessão</button>
            <button className="btn" ref={qrBtnRef} onClick={() => setQrOpen(v => !v)}>Mostrar QR</button>
            <button className="btn btn-danger" onClick={logout}>Desconectar</button>
            <button className="btn" disabled={testing} onClick={test}>Testar</button>
          </div>
          <PopoverPortal anchorEl={qrBtnRef.current} open={qrOpen} onClose={() => setQrOpen(false)}>
            <div className="p-3">
              {qr ? <img alt="QR" src={qr} className="w-56 h-56" /> : <div className="text-sm">Aguardando QR…</div>}
            </div>
          </PopoverPortal>
        </>
      )}
    </div>
  );
}
