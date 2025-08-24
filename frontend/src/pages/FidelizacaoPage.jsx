import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { api } from '../api/axios';

export default function FidelizacaoPage() {
  const [clients, setClients] = useState([]);
  const [nps, setNps] = useState({});
  const [rewards, setRewards] = useState({});
  const [modalClient, setModalClient] = useState(null);
  const [score, setScore] = useState(10);
  const [comment, setComment] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/admin/clients');
        const list = res.data.clients || [];
        setClients(list);
        list.forEach((c) => {
          fetchNps(c.id);
          fetchRewards(c.id);
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const fetchNps = async (clientId) => {
    try {
      const r = await axios.get('/nps/results', { params: { clientId } });
      setNps((prev) => ({ ...prev, [clientId]: r.data }));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRewards = async (clientId) => {
    try {
      const r = await axios.get('/rewards', { params: { clientId } });
      setRewards((prev) => ({ ...prev, [clientId]: r.data }));
    } catch (e) {
      console.error(e);
    }
  };

  const openModal = (client) => {
    setModalClient(client);
    setScore(10);
    setComment('');
  };

  const sendSurvey = async () => {
    if (!modalClient) return;
    const { data: survey } = await axios.post('/nps/send', {
      clientId: modalClient.id,
    });
    await axios.post(`/nps/respond/${survey.id}`, {
      score: Number(score),
      comment,
    });
    await fetchNps(modalClient.id);
    setModalClient(null);
  };

  const programarRecompensa = async (clientId) => {
    const type = prompt('Tipo de recompensa (cupom/bonus/upgrade):');
    if (!type) return;
    const value = prompt('Valor/descrição:') || '';
    await axios.post('/rewards', { clientId, type, value });
    await fetchRewards(clientId);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Fidelização</h2>
      {clients.map((c) => (
        <div key={c.id} className="border rounded p-4 mb-4">
          <h3 className="font-semibold">{c.company_name || c.nome}</h3>
          <p>Último NPS: {nps[c.id]?.[0]?.score ?? 'N/A'}</p>
          <p>
            Histórico: {nps[c.id]?.map((r) => r.score).join(', ') || 'Sem respostas'}
          </p>
          <button className="mr-2" onClick={() => openModal(c)}>
            Enviar Pesquisa NPS
          </button>
          <button className="mr-2" onClick={() => alert('Campanha gerada!')}>
            Gerar Campanha
          </button>
          <button onClick={() => programarRecompensa(c.id)}>
            Programar Recompensa
          </button>
          {rewards[c.id]?.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Recompensas:{' '}
              {rewards[c.id]
                .map((r) => r.type + (r.value ? ` (${r.value})` : ''))
                .join(', ')}
            </div>
          )}
        </div>
      ))}

      {modalClient && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-4 rounded shadow w-80">
            <h4 className="font-semibold mb-2">
              Enviar NPS - {modalClient.company_name || modalClient.nome}
            </h4>
            <label className="block mb-2">
              Nota (0-10):
              <input
                type="number"
                min="0"
                max="10"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="border w-full"
              />
            </label>
            <label className="block mb-2">
              Comentário:
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="border w-full"
              />
            </label>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setModalClient(null)}>Cancelar</button>
              <button onClick={sendSurvey}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


