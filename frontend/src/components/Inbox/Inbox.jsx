import { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';

function ChannelBadge({ channel }) {
  const map = {
    whatsapp: { emoji: "🟢", color: "#25D366", label: "WhatsApp" },
    instagram: { emoji: "🟣", color: "#C13584", label: "Instagram" },
    facebook: { emoji: "🔵", color: "#1877F3", label: "Facebook" },
  };
  const c = map[channel] || { emoji: "❔", color: "#666", label: "Desconhecido" };
  return <span title={c.label} style={{ color: c.color }}>{c.emoji}</span>;
}

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [filters, setFilters] = useState({ name: '', phone: '', category: '' });

  useEffect(() => {
    const params = {};
    if (filters.name) params.name = filters.name;
    if (filters.phone) params.phone = filters.phone;
    if (filters.category) params.category_id = filters.category;
    inboxApi.get('/conversations', { params }).then(res => setConversations(res.data)).catch(()=>{});
  }, [filters]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Inbox Omnichannel</h1>
      <div className="flex gap-4 mb-4">
        <input placeholder="Nome" className="border p-2 rounded" onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} />
        <input placeholder="Telefone" className="border p-2 rounded" onChange={e => setFilters(f => ({ ...f, phone: e.target.value }))} />
        <input placeholder="Categoria (ID)" className="border p-2 rounded" onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} />
      </div>
      <ul>
        {conversations.map(conv => (
          <li key={conv.id} className="border p-2 my-2 flex items-center gap-2 bg-white rounded shadow-sm">
            <ChannelBadge channel={conv.channel} />
            <span className="font-semibold">{conv.Contact?.name || '-'}</span>
            <span className="ml-2 text-gray-500">{conv.Contact?.phone || ''}</span>
            <span className="ml-2 text-xs bg-gray-100 px-2 rounded">{conv.Category?.name || 'Sem Categoria'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
