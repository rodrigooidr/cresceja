import React, { useEffect, useState } from 'react';
import api from '../api/api';

export default function QuickRepliesPage() {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');

  const load = async () => {
    const { data } = await api.get('/api/quick-messages');
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!text.trim()) return;
    await api.post('/api/quick-messages', { text });
    setText('');
    await load();
  };

  const update = async (id, txt) => {
    await api.put(`/api/quick-messages/${id}`, { text: txt });
    await load();
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1>Respostas rápidas</h1>
      <div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Nova resposta" />
        <button onClick={create}>Adicionar</button>
      </div>
      <ul>
        {items.map(i => (
          <li key={i.id} style={{ marginTop: 8 }}>
            <input value={i.text} onChange={e => update(i.id, e.target.value)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
