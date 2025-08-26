import inboxApi from "../../api/inboxApi";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      await inboxApi.post('http://localhost:4000/api/auth/register', {
        email,
        password: senha
      });
      setOk(true);
      setErro('');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setErro('Erro ao criar conta. Tente novamente.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">Criar Conta</h1>
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        {ok && <p className="text-green-600 text-sm">Conta criada com sucesso!</p>}
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
        <button className="bg-green-600 text-white w-full py-2 rounded" onClick={handleRegister}>
          Criar Conta
        </button>
        <p className="text-sm text-center">
          Já tem conta? <a href="/login" className="text-blue-600 underline">Entrar</a>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
