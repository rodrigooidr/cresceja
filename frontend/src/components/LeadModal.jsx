import React, { useState } from 'react';
import api from '../api/api';

export default function LeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', origem: 'site' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.telefone) {
      setError('Nome e telefone são obrigatórios');
      return;
    }
    try {
      await api.post('/api/leads', form);
      onSaved();
    } catch (err) {
      setError('Erro ao salvar');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded w-full max-w-md">
        <h2 className="text-xl mb-4">Novo Lead</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border px-3 py-2"
            name="nome"
            placeholder="Nome"
            value={form.nome}
            onChange={handleChange}
          />
          <input
            className="w-full border px-3 py-2"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />
          <input
            className="w-full border px-3 py-2"
            name="telefone"
            placeholder="Telefone"
            value={form.telefone}
            onChange={handleChange}
          />
          <select
            className="w-full border px-3 py-2"
            name="origem"
            value={form.origem}
            onChange={handleChange}
          >
            <option value="site">site</option>
            <option value="whatsapp">whatsapp</option>
            <option value="instagram">instagram</option>
            <option value="outros">outros</option>
          </select>
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
