import React, { useEffect, useState } from 'react';
import api from '../api/api';

export default function QualificacaoPage() {
  const [leads, setLeads] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  const [form, setForm] = useState({ score: 0, tags: '', responsavel: '' });

  const loadLeads = async () => {
    const { data } = await api.get('/api/leads');
    setLeads(data);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const openModal = (lead) => {
    setCurrentLead(lead);
    setForm({
      score: lead.score || 0,
      tags: (lead.tags || []).join(','),
      responsavel: lead.responsavel || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    await api.put(`/api/leads/${currentLead.id}/qualificar`, {
      score: Number(form.score),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      responsavel: form.responsavel
    });
    setShowModal(false);
    setCurrentLead(null);
    loadLeads();
  };

  const enviarMensagem = () => {
    alert('Mensagem enviada! (simulado)');
  };

  const moverParaOportunidade = async (lead) => {
    await api.post(`/api/leads/${lead.id}/mover-para-oportunidade`);
    alert('Lead movido para oportunidade (stub)');
    loadLeads();
  };

  const rowColor = (score) => {
    if (score >= 70) return 'bg-red-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-blue-100';
  };

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Qualificação de Leads</h1>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left">Nome</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Telefone</th>
            <th className="px-4 py-2 text-left">Score</th>
            <th className="px-4 py-2 text-left">Tags</th>
            <th className="px-4 py-2 text-left">Responsável</th>
            <th className="px-4 py-2 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className={`${rowColor(l.score)} border-t`}>
              <td className="px-4 py-2">{l.nome}</td>
              <td className="px-4 py-2">{l.email}</td>
              <td className="px-4 py-2">{l.telefone}</td>
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
              <td className="px-4 py-2 space-x-2">
                <button
                  className="text-blue-600"
                  onClick={() => openModal(l)}
                >
                  Pontuar Lead
                </button>
                <button
                  className="text-green-600"
                  onClick={enviarMensagem}
                >
                  Enviar Mensagem
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

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-4 rounded w-80">
            <h2 className="text-lg mb-2">Pontuar Lead</h2>
            <div className="mb-2">
              <label className="block text-sm mb-1">Score</label>
              <input
                type="number"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                className="w-full border px-2 py-1"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm mb-1">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full border px-2 py-1"
                placeholder="tag1, tag2"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm mb-1">Responsável</label>
              <input
                type="text"
                value={form.responsavel}
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                className="w-full border px-2 py-1"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="mr-2 px-3 py-1"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded"
                onClick={handleSave}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
