import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';
import { makeSocket } from '../../sockets/socket';

function ConversationItem({ c, onOpen }) {
  return (
    <button onClick={() => onOpen(c)} className="w-full px-3 py-2 hover:bg-gray-100 flex gap-3 border-b">
      <img src={c.contact.photo_url || 'https://placehold.co/40'} alt="avatar" className="w-10 h-10 rounded-full"/>
      <div className="text-left">
        <div className="font-medium">{c.contact.name || c.contact.phone_e164 || 'Contato'}</div>
        <div className="text-xs text-gray-500">{c.channel} · {c.status}</div>
      </div>
    </button>
  );
}

export default function InboxPage() {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    inboxApi.get('/conversations').then(({ data }) => setItems(data.items || []));
  }, []);

  useEffect(() => {
    const s = makeSocket();
    s.on('message:new', ({ conversationId, data }) => {
      if (sel?.id === conversationId) setMsgs((m) => [data, ...m]);
    });
    return () => s.close();
  }, [sel]);

  const open = async (c) => {
    setSel(c);
    const { data } = await inboxApi.get(`/conversations/${c.id}/messages`);
    setMsgs(data.items || []);
  };

  const send = async () => {
    if (!text.trim()) return;
    const { data } = await inboxApi.post(`/conversations/${sel.id}/messages`, { type: 'text', text });
    setMsgs((m) => [data.data, ...m]);
    setText('');
  };

  return (
    <div className="grid grid-cols-12 h-[calc(100vh-80px)]">
      {/* Coluna esquerda */}
      <div className="col-span-3 border-r overflow-y-auto">
        <div className="p-2"><input placeholder="Buscar..." className="w-full border rounded px-3 py-2"/></div>
        {items.map((c) => <ConversationItem key={c.id} c={c} onOpen={open}/>)}
      </div>

      {/* Coluna central */}
      <div className="col-span-6 flex flex-col">
        <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 gap-2">
          {msgs.map((m) => (
            <div key={m.id} className={`max-w-[70%] p-2 rounded ${m.from === 'customer' ? 'bg-gray-100 self-start' : 'bg-blue-100 self-end'}`}>
              {m.text || <em>[{m.type}]</em>}
            </div>
          ))}
        </div>
        {sel && (
          <div className="p-3 border-t flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite..." className="flex-1 border rounded px-3 py-2"/>
            <button onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded">Enviar</button>
          </div>
        )}
      </div>

      {/* Coluna direita */}
      <div className="col-span-3 border-l p-4">
        {sel ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={sel.contact.photo_url || 'https://placehold.co/56'} alt="avatar" className="w-14 h-14 rounded-full"/>
              <div>
                <div className="font-semibold">{sel.contact.name || 'Contato'}</div>
                <div className="text-sm text-gray-500">{sel.contact.phone_e164}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">Canal: {sel.channel}</div>
            <div className="text-sm text-gray-600">Status: {sel.status}</div>
          </div>
        ) : <div className="text-gray-500">Selecione uma conversa</div>}
      </div>
    </div>
  );
}
