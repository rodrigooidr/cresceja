import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ClientForm = ({ selected, onSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setEmail(selected.email);
      setPhone(selected.phone);
    }
  }, [selected]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const client = { name, email, phone };
    const token = localStorage.getItem('token');
    try {
      if (selected) {
        await axios.put(`http://localhost:4000/api/clients/${selected.id}`, client, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:4000/api/clients', client, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSuccess();
    } catch (err) {
      alert('Erro ao salvar cliente');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" required />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone" required />
      <button type="submit">Salvar</button>
      <button type="button" onClick={onCancel}>Cancelar</button>
    </form>
  );
};

export default ClientForm;