import { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';

function ChannelIcon({ kind }) {
  const map = { whatsapp: '🟢', instagram: '🟣', facebook: '🔵' };
  return <span className="text-lg">{map[kind] || '❔'}</span>;
}

export default function ConversationList({ onSelect, selectedId }) {
  const [convs, setConvs] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', channel: '', tag: '' });

  useEffect(() => {
    inboxApi
      .get('/inbox/conversations', { params: filters })
      .then((r) => setConvs(r.data.data || []))
      .catch(() => {});
  }, [filters]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 space-y-1">
        <input
          placeholder="Buscar"
          className="w-full border p-1 rounded"
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
      </div>
      <ul className="flex-1 overflow-y-auto">
        {convs.map((c) => (
          <li
            key={c.id}
            onClick={() => onSelect(c)}
            className={
              `p-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${
                selectedId === c.id ? 'bg-gray-200' : ''
              }`
            }
          >
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
              {c.photo_asset_id ? (
                <img src={`/api/assets/${c.photo_asset_id}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{c.display_name?.[0] || '?'}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.display_name || c.phone}</div>
              <div className="text-xs text-gray-500 truncate">{c.status}</div>
            </div>
            <ChannelIcon kind={c.channel_kind} />
          </li>
        ))}
      </ul>
    </div>
  );
}
