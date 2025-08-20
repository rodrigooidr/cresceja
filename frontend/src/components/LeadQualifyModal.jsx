import React, { useState } from 'react';
import api from '../api/api';

export default function LeadQualifyModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState({
    score: lead?.score ?? 0,
    tags: (lead?.tags || []).join(','),
    responsavel: lead?.responsavel || '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const score = Number(form.score);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      setError('Score deve estar entre 0 e 100');
      return;
    }
    if (!form.responsavel.trim()) {
      setError('Responsável é obrigatório');
      return;
    }
    try {
      await api.put(`/api/leads/${lead.id}/qualificar`, {
        score,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        responsavel: form.responsavel.trim(),
        status: 'qualificando',
      });
      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      setError('Erro ao salvar');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded w-full max-w-md">
        <h2 className="text-xl mb-4">Qualificar Lead</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="number"
            name="score"
            value={form.score}
            onChange={handleChange}
            className="w-full border px-3 py-2"
            placeholder="Score (0-100)"
          />
          <input
            type="text"
            name="tags"
            value={form.tags}
            onChange={handleChange}
            className="w-full border px-3 py-2"
            placeholder="tag1, tag2"
          />
          <input
            type="text"
            name="responsavel"
            value={form.responsavel}
            onChange={handleChange}
            className="w-full border px-3 py-2"
            placeholder="Responsável"
          />
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
