import React, { useState } from 'react';
import axios from 'axios';

function CreateUser({ onUserCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Operador'
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setMsg('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await axios.post('http://localhost:4000/api/users', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg('Usuário criado com sucesso!');
      setForm({ name: '', email: '', password: '', role: 'Operador' });
      onUserCreated && onUserCreated();
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao criar usuário.');
    }
  };

  return (
    <div className="create-user-container">
      <h4>Cadastrar Novo Usuário</h4>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Nome" value={form.name} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Senha" value={form.password} onChange={handleChange} required minLength={6} />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="Operador">Operador</option>
          <option value="Marketing">Marketing</option>
          <option value="Admin">Admin</option>
        </select>
        <br />
        <button type="submit">Salvar</button>
        <button type="button" onClick={onCancel} style={{ marginLeft: 10, background: '#eee', color: '#333' }}>Cancelar</button>
      </form>
      {msg && <div className="toast-success">{msg}</div>}
      {error && <div className="toast-error">{error}</div>}
    </div>
  );
}

export default CreateUser;