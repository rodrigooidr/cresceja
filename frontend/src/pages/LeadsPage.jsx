import React, { useState, useEffect } from 'react';
import api from '../api/api';
import LeadModal from '../components/LeadModal';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const loadLeads = async () => {
    const { data } = await api.get('/api/leads');
    setLeads(data);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleSaved = () => {
    setShowModal(false);
    loadLeads();
  };

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
      {showModal && (
        <LeadModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
