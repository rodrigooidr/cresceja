import React, { useState, useEffect } from 'react';
import inboxApi, { apiUrl } from '../../api/inboxApi';
import ChannelCard from './ChannelCard';
import Dialog from './ChannelWizard/Dialog';

function WhatsAppBaileysCard({ data, refresh }) {
  if (!data || !data.allowed) {
    return null;
  }
  const items = data.items || [];
  const canConnect = items.length < (data.max_slots || 1);

  const [session, setSession] = useState(null); // {id}
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let timer;
    async function poll() {
      if (!session) return;
      const { data: s } = await inboxApi.get(`/channels/whatsapp/baileys/sessions/${session.id}`);
      if (s.status === 'connected') {
        setSession(null);
        setQr(null);
        refresh();
      } else if (s.status === 'error') {
        setSession(null);
      } else {
        timer = setTimeout(poll, 500);
      }
    }
    poll();
    return () => clearTimeout(timer);
  }, [session, refresh]);

  async function startSession() {
    const { data: s } = await inboxApi.post('/channels/whatsapp/baileys/sessions', {});
    setSession(s);
    const { data: q } = await inboxApi.get(`/channels/whatsapp/baileys/sessions/${s.id}/qr`);
    const url = q.qr_data_url || apiUrl(q.asset_url);
    setQr(url);
  }

  async function disconnect(id) {
    await inboxApi.delete(`/channels/whatsapp/baileys/sessions/${id}`);
    refresh();
  }

  return (
    <ChannelCard title="WhatsApp Baileys" testId="card-wa-baileys">
      <ul>
        {items.map((s) => (
          <li key={s.id} className="mb-1">
            {s.label || s.id} - {s.status}
            <button
              data-testid="baileys-disconnect"
              className="ml-2 text-red-600"
              onClick={() => disconnect(s.id)}
            >
              Desconectar
            </button>
          </li>
        ))}
      </ul>
      <button
        data-testid="baileys-connect-cta"
        disabled={!canConnect}
        className="mt-2 px-3 py-1 bg-green-600 text-white disabled:opacity-50"
        onClick={startSession}
      >
        Conectar via QR
      </button>

      {qr && (
        <Dialog onClose={() => setSession(null)}>
          <img data-testid="baileys-qr-img" src={qr} alt="qr" />
        </Dialog>
      )}
    </ChannelCard>
  );
}

export default WhatsAppBaileysCard;
