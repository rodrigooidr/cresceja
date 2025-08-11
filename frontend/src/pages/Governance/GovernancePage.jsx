import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

function GovernancePage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [logs, setLogs] = useState([]);

  const carregarLogs = async () => {
    try {
      const res = await api.get('/logs/ia');
      const ordenado = res.data.sort((a, b) => new Date(b.data) - new Date(a.data));
      setLogs(ordenado);
    } catch (err) {
      console.error('Erro ao carregar logs de IA', err);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold mb-4">Governança e Logs de IA</h1>
        <button type="button" onClick={carregarLogs} className="text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60" disabled={loading}>Atualizar</button>
      </div>
      {erro && (<div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{erro}</div>)}
      {logs.length === 0 ? (
        <p className="text-gray-500">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ul className="space-y-4">
          {logs.map(log => (
            <li key={log.id} className="bg-white p-4 rounded shadow text-sm">
              <div className="flex justify-between">
                <div>
                  <p className="text-gray-800">
                    <strong>{log.user}</strong> usou IA para <strong>{log.tipo}</strong>
                  </p>
                  <p className="text-gray-600 mt-1">{log.conteudo}</p>
                </div>
                <span className="text-xs text-gray-500">{new Date(log.data).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GovernancePage;