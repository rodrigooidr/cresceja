import React, { useEffect, useState, useRef } from 'react';
import { useApi } from '../../contexts/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { io } from 'socket.io-client';

function ChatPage() {
  const api = useApi();
  const { token, user } = useAuth();
  const [fila, setFila] = useState([]);
  const [meus, setMeus] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [texto, setTexto] = useState('');
  const socketRef = useRef(null);

  const carregarConversas = async () => {
    try {
      const f = await api.get('/conversations?status=pendente');
      const m = await api.get('/conversations?assigned_to=me');
      setFila(f.data);
      setMeus(m.data);
    } catch (err) {
      console.error('Erro ao carregar conversas', err);
    }
  };

  const carregarMensagens = async (id) => {
    try {
      const res = await api.get(`/messages/${id}`);
      setMensagens(res.data);
    } catch (err) {
      console.error('Erro ao carregar mensagens', err);
    }
  };

  const enviarMensagem = () => {
    if (!texto.trim() || !selecionada) return;
    socketRef.current?.emit('enviar_mensagem', {
      canal: selecionada.canal,
      texto,
      conversation_id: selecionada.id
    });
    setTexto('');
  };

  const assumirAtendimento = async (id) => {
    try {
      await api.put(`/conversations/${id}/assumir`);
      await carregarConversas();
      const conv = meus.find(c => c.id === id);
      setSelecionada(conv || null);
    } catch (err) {
      console.error('Erro ao assumir atendimento', err);
    }
  };

  useEffect(() => {
    carregarConversas();
  }, []);

  useEffect(() => {
    if (selecionada) carregarMensagens(selecionada.id);
  }, [selecionada]);

  useEffect(() => {
    if (!token) return;

    const socket = io('ws://localhost:4000', {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 WebSocket conectado');
    });

    socket.on('nova_mensagem', (msg) => {
      if (msg.conversation_id === selecionada?.id) {
        setMensagens((m) => [...m, msg]);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selecionada]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-72 bg-gray-100 border-r overflow-y-auto p-3">
        <h2 className="font-bold mb-2">🟡 Fila de Espera</h2>
        {fila.map(conv => (
          <div key={conv.id} className="mb-2 p-2 bg-white rounded shadow text-sm">
            <p>{conv.nome || 'Cliente sem nome'}</p>
            <p className="text-xs text-gray-500">{conv.canal}</p>
            <button
              onClick={() => assumirAtendimento(conv.id)}
              className="text-xs text-blue-600 underline mt-1"
            >
              Assumir
            </button>
          </div>
        ))}
        <hr className="my-3" />
        <h2 className="font-bold mb-2">🟢 Meus Atendimentos</h2>
        {meus.map(conv => (
          <button
            key={conv.id}
            onClick={() => setSelecionada(conv)}
            className={\`block w-full text-left p-2 rounded mb-2 \${selecionada?.id === conv.id ? 'bg-blue-500 text-white' : 'bg-white'}\`}
          >
            {conv.nome || 'Cliente'} <br />
            <span className="text-xs text-gray-500">{conv.canal}</span>
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col p-4">
        <h1 className="text-xl font-bold mb-3">Atendimento</h1>

        <div className="flex-1 bg-white border rounded p-3 overflow-y-auto">
          {mensagens.map((m, idx) => (
            <div key={idx} className="mb-2">
              <span className="text-gray-700 text-sm">{m.sender_type || 'cliente'}: </span>
              <span>{m.texto || m.content}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="flex-1 border p-2 rounded-l"
            placeholder="Digite sua mensagem..."
          />
          <button onClick={enviarMensagem} className="bg-blue-600 text-white px-4 rounded-r">
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;