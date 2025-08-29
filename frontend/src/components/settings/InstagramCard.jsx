import React from 'react';
import inboxApi from '../../api/inboxApi';
import ChannelCard from './ChannelCard';

function InstagramCard({ data, refresh }) {
  if (!data || !data.enabled) return null;

  async function connect() {
    await inboxApi.post('/channels/instagram/connect');
    refresh();
  }

  async function disconnect() {
    await inboxApi.delete('/channels/instagram/disconnect');
    refresh();
  }

  return (
    <ChannelCard title="Instagram" testId="card-instagram">
      <div>Status: {data.connected ? 'connected' : 'disconnected'}</div>
      {data.connected ? (
        <button className="mt-2 px-3 py-1 bg-red-600 text-white" onClick={disconnect}>
          Desconectar
        </button>
      ) : (
        <button className="mt-2 px-3 py-1 bg-blue-600 text-white" onClick={connect}>
          Conectar
        </button>
      )}
    </ChannelCard>
  );
}

export default InstagramCard;
