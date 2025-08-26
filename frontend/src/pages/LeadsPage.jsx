import inboxApi from "../../api/inboxApi";
import React, { useState, useEffect } from 'react';
import inboxApi from '../api/inboxApi.js'; 
import LeadModal from '../components/LeadModal';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const loadLeads = async () => {
    const res = await inboxApei.get('/leads', { params: { page, limit } });
    setLeads(res.data.data);
    setTotal(res.data.meta.total);
  };

  useEffect(() => {
    loadLeads();
  }, [page]);

  const handleSaved = () => {
    loadLeads();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setShowModal(true)}
        >
          + Novo Lead
        </button>
      </div>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left">Nome</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Telefone</th>
            <th className="px-4 py-2 text-left">Origem</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Data de Entrada</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-4 py-2">{l.nome}</td>
              <td className="px-4 py-2">{l.email}</td>
              <td className="px-4 py-2">{l.telefone}</td>
              <td className="px-4 py-2">{l.origem}</td>
              <td className="px-4 py-2">{l.status}</td>
              <td className="px-4 py-2">
                {new Date(l.created_at).toLocaleDateString()}
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
      {showModal && (
        <LeadModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}


