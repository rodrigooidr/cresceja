import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:4000/api/auth/login', {
        email,
        password: senha
      });
      login(res.data.token);
      navigate('/');
    } catch (err) {
      setErro('Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">Entrar no CresceJá</h1>
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <input
          type="email"
          placeholder="E-mail"
          className="border p-2 rounded w-full"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Senha"
          className="border p-2 rounded w-full"
          value={senha}
          onChange={e => setSenha(e.target.value)}
        />
        <button className="bg-blue-600 text-white w-full py-2 rounded" onClick={handleLogin}>
          Entrar
        </button>
        <p className="text-sm text-center">
          Não tem conta? <a href="/register" className="text-blue-600 underline">Crie uma agora</a>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;