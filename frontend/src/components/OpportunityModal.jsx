import inboxApi from "../../api/inboxApi";
import React, { useState } from 'react';
import { useApi } from '../contexts/useApi';

export default function OpportunityModal({ onClose, onSaved }) {
  const api = useApi();
  const [form, setForm] = useState({
    cliente: '',
    valor_estimado: 0,
    responsavel: '',
    lead_id: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        cliente: form.cliente,
        valor_estimado: Number(form.valor_estimado) || 0,
        responsavel: form.responsavel || null,
        lead_id: form.lead_id || null,
      };
      await inboxApi.post('/opportunities', payload);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao criar oportunidade', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow w-80 space-y-2">
        <h3 className="text-lg font-semibold mb-2">Nova Oportunidade</h3>
        <div>
          <label className="block text-sm mb-1">Cliente *</label>
          <input
            name="cliente"
            value={form.cliente}
            onChange={handleChange}
            required
            className="w-full border p-1 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Valor Estimado</label>
          <input
            name="valor_estimado"
            type="number"
            value={form.valor_estimado}
            onChange={handleChange}
            className="w-full border p-1 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Responsável</label>
          <input
            name="responsavel"
            value={form.responsavel}
            onChange={handleChange}
            className="w-full border p-1 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Lead ID</label>
          <input
            name="lead_id"
            value={form.lead_id}
            onChange={handleChange}
            className="w-full border p-1 rounded"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1 border rounded">
            Cancelar
          </button>
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}


