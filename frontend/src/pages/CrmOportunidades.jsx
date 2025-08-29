import inboxApi from "../../api/inboxApi";
import React, { useEffect, useState } from 'react';
import { useApi } from '../contexts/useApi';

const STATUS = [
  { value: '', label: 'Todos' },
  { value: 'novo', label: 'Novo' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
];

function CrmOportunidades() {
  const api = useApi();
  const [oportunidades, setOportunidades] = useState([]);
  const [filtro, setFiltro] = useState('novo');
  const [salvando, setSalvando] = useState(null);

  const fetchOportunidades = async () => {
    try {
      const qs = filtro ? `?status=${encodeURIComponent(filtro)}` : '';
      const res = await inboxApi.get(`/crm/oportunidades${qs}`);
      setOportunidades(res.data);
    } catch (err) {
      console.error('Erro ao buscar oportunidades', err);
    }
  };

  const atualizarStatus = async (id, status) => {
    try {
      setSalvando(id);
      // atualização otimista
      setOportunidades(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      await inboxApi.put(`/crm/oportunidades/${id}`, { status });
    } catch (err) {
      console.error('Erro ao atualizar status', err);
      // fallback: recarrega lista
      fetchOportunidades();
    } finally {
      setSalvando(null);
    }
  };

  useEffect(() => {
    fetchOportunidades();
  }, [filtro]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Oportunidades de CRM</h2>

      <div className="mb-4 flex items-center gap-2">
        <label className="mr-2">Filtrar por status:</label>
        <select
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="border p-2 rounded"
        >
          {STATUS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button onClick={fetchOportunidades} className="ml-2 text-sm px-3 py-2 bg-gray-200 rounded">
          Atualizar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border rounded shadow text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">E-mail</th>
              <th className="p-2 text-left">WhatsApp</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Canal</th>
              <th className="p-2 text-left">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {oportunidades.map(opp => (
              <tr key={opp.id} className="border-t">
                <td className="p-2">{opp.name}</td>
                <td className="p-2">{opp.email}</td>
                <td className="p-2">{opp.whatsapp}</td>
                <td className="p-2">
                  <select
                    value={opp.status}
                    onChange={e => atualizarStatus(opp.id, e.target.value)}
                    className="border p-1 rounded"
                    disabled={salvando === opp.id}
                  >
                    {STATUS.filter(s => s.value !== '').map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">{opp.channel}</td>
                <td className="p-2">{new Date(opp.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CrmOportunidades;

