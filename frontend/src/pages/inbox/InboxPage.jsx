import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function InboxPage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    const { data } = await axios.get('/api/inbox');
    setConversations(data.data || []);
  }

  async function openConversation(c) {
    setSelected(c);
    const { data } = await axios.get(`/api/inbox/${c.id}/messages`);
    setMessages(data.data || []);
  }

  async function send() {
    if (!text || !selected) return;
    const { data } = await axios.post(`/api/inbox/${selected.id}/messages`, { content: text });
    setMessages([...messages, data.data]);
    setText('');
  }

  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r overflow-y-auto">
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => openConversation(c)}
            className={`p-2 cursor-pointer ${selected?.id === c.id ? 'bg-gray-200' : ''}`}
          >
            <div className="font-bold">{c.contact_name || c.id}</div>
            <div className="text-sm text-gray-500">{c.status}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-2">
          {messages.map((m) => (
            <div key={m.id} className={`my-1 ${m.sender === 'agent' ? 'text-right' : ''}`}>
              <span className="inline-block bg-gray-100 px-2 py-1 rounded">
                {m.content}
              </span>
            </div>
          ))}
        </div>
        {selected && (
          <div className="p-2 border-t flex">
            <input
              className="flex-1 border p-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              onClick={send}
              className="ml-2 px-4 py-1 bg-blue-500 text-white"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
