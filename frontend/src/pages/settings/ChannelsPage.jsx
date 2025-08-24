import axios from 'axios';
import React, { useEffect, useState } from 'react';
import api from "../../api/api";
import { useAuth } from '../../contexts/AuthContext';

export default function ChannelsPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [qr, setQr] = useState(null);
  const allowBaileys = !!user?.allowBaileys;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await axios.get('/api/channels');
    setChannels(data.data || []);
  }

  async function connect(type) {
    await axios.post('/api/channels', { type, name: type });
    load();
  }

  async function startBaileys(id) {
    const { data } = await axios.post('/api/channels/whatsapp/baileys/session', { channelId: id });
    setQr(data.data?.qr || null);
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold mb-2">Canais conectados</h2>
        <ul>
          {channels.map((c) => (
            <li key={c.id} className="mb-1">
              {c.type} - {c.name}
              {c.type === 'whatsapp_baileys' && (
                <button
                  className="ml-2 text-blue-600 text-sm"
                  onClick={() => startBaileys(c.id)}
                >
                  Nova sessão
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-bold mb-2">Conectar novo</h2>
        <button
          className="px-3 py-1 bg-blue-500 text-white mr-2"
          onClick={() => connect('whatsapp_cloud')}
        >
          WhatsApp Cloud
        </button>
        {allowBaileys && (
          <button
            className="px-3 py-1 bg-green-500 text-white"
            onClick={() => connect('whatsapp_baileys')}
          >
            Baileys
          </button>
        )}
      </div>
      {qr && (
        <div>
          <h3 className="font-bold">QR Code</h3>
          <img src={qr} alt="QR" />
        </div>
      )}
    </div>
  );
}

