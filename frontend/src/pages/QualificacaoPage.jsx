import React, { useState, useCallback } from 'react';
import inboxApi from '../api/inboxApi';
import useOrgRefetch from '../hooks/useOrgRefetch';
import LeadQualifyModal from '../components/LeadQualifyModal';

export default function QualificacaoPage() {
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('todos');
  const [currentLead, setCurrentLead] = useState(null);

  const loadLeads = useCallback(async () => {
    const params = { page, limit };
    if (status !== 'todos') params.status = status;
    const { data } = await inboxApi.get('/leads', { params });
    setLeads(data?.data || data?.items || []);
    setTotal(data?.meta?.total || 0);
  }, [page, status]);

  useOrgRefetch(loadLeads, [loadLeads]);

  const openModal = (lead) => setCurrentLead(lead);
  const closeModal = () => setCurrentLead(null);
  const handleSaved = () => {
    closeModal();
    loadLeads();
  };

  const moverParaOportunidade = async (lead) => {
    await inboxApi.post(`/leads/${lead.id}/mover-para-oportunidade`);
    alert('Solicitado');
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Qualificação de Leads</h1>
      <div className="mb-4 flex items-center space-x-2">
        <label className="text-sm">Status:</label>
        <select
          className="border px-2 py-1"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="todos">todos</option>
          <option value="novo">novo</option>
          <option value="qualificando">qualificando</option>
        </select>
      </div>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left">Nome</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Telefone</th>
            <th className="px-4 py-2 text-left">Origem</th>
            <th className="px-4 py-2 text-left">Score</th>
            <th className="px-4 py-2 text-left">Tags</th>
            <th className="px-4 py-2 text-left">Responsável</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-4 py-2">{l.nome}</td>
              <td className="px-4 py-2">{l.email}</td>
              <td className="px-4 py-2">{l.telefone}</td>
              <td className="px-4 py-2">{l.origem}</td>
              <td className="px-4 py-2">{l.score}</td>
              <td className="px-4 py-2">
                {(l.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-block bg-gray-200 text-xs px-2 py-1 mr-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </td>
              <td className="px-4 py-2">{l.responsavel}</td>
              <td className="px-4 py-2">{l.status}</td>
              <td className="px-4 py-2 space-x-2">
                <button
                  className="text-blue-600"
                  onClick={() => openModal(l)}
                >
                  Qualificar
                </button>
                <button
                  className="text-purple-600"
                  onClick={() => moverParaOportunidade(l)}
                >
                  Mover para Oportunidade
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center mt-4">
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Anterior
        </button>
        <span>
          Página {page} de {totalPages}
        </span>
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= totalPages}
        >
          Próximo
        </button>
      </div>
      {currentLead && (
        <LeadQualifyModal
          lead={currentLead}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}


