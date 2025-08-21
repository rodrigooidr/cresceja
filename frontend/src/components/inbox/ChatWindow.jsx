import { useEffect, useRef, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';

export default function ChatWindow({ conversation }) {
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    inboxApi
      .get(`/inbox/conversations/${conversation.id}/messages`)
      .then((r) => setMessages(r.data.data || []))
      .catch(() => {});
  }, [conversation.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
          <div className={`px-3 py-2 rounded max-w-xs ${m.direction === 'out' ? 'bg-blue-200' : 'bg-gray-200'}`}>
            {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
            {m.transcript && (
              <div className="text-xs text-gray-500 mt-1">📝 {m.transcript}</div>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
