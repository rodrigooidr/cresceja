import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

const canais = ['whatsapp', 'instagram', 'facebook'];

function AgendaPage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [canal, setCanal] = useState('whatsapp');

  const carregarEventos = async () => {
    try {
      const res = await api.get('/agenda');
      setEventos(res.data);
    } catch (err) {
      console.error('Erro ao carregar agenda', err);
    }
  };

  const adicionarEvento = async () => {
    if (!titulo || !data || !canal) return;
    try {
      await api.post('/agenda', { title: titulo, date: data, channel: canal });
      setTitulo('');
      setData('');
      carregarEventos();
    } catch (err) {
      console.error('Erro ao agendar', err);
    }
  };

  useEffect(() => {
    carregarEventos();
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold mb-4">Agenda</h1>
        <button type="button" onClick={carregarEventos} className="text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60" disabled={loading}>Atualizar</button>
      </div>
      {erro && (<div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{erro}</div>)}

      <div className="flex gap-2 mb-4">
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Título"
          className="border p-2 rounded w-60"
        />
        <input
          type="datetime-local"
          value={data}
          onChange={e => setData(e.target.value)}
          className="border p-2 rounded"
        />
        <select
          value={canal}
          onChange={e => setCanal(e.target.value)}
          className="border p-2 rounded"
        >
          {canais.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={adicionarEvento} className="bg-green-600 text-white px-4 py-2 rounded">
          + Agendar
        </button>
      </div>

      <ul className="space-y-2">
        {eventos.map((ev, i) => (
          <li key={i} className="bg-white p-3 rounded shadow text-sm">
            <strong>{ev.title}</strong> — {new Date(ev.date).toLocaleString()} via {ev.channel}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AgendaPage;