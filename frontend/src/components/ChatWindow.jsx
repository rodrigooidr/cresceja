import React, { useState } from 'react';

function ChatWindow({ channel }) {
  const [messages, setMessages] = useState([
    { from: 'client', text: 'Olá, quero saber mais!' }
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (input.trim() === '') return;
    setMessages([...messages, { from: 'agent', text: input }]);
    setInput('');
  };

  return (
    <div className="border p-4 rounded bg-white max-w-2xl">
      <h2 className="font-semibold mb-2">Canal: {channel.toUpperCase()}</h2>
      <div className="h-64 overflow-y-auto border p-2 mb-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`mb-1 text-sm ${
              m.from === 'agent' ? 'text-right text-blue-700' : 'text-left text-gray-800'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="border flex-1 p-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua resposta..."
        />
        <button className="bg-blue-600 text-white px-4 rounded" onClick={sendMessage}>
          Enviar
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
