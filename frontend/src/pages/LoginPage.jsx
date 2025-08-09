import { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useContext(AuthContext);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
      navigate('/inbox');
    } catch (err) {
      setError('Login inválido');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <form className="bg-white p-8 rounded shadow w-96" onSubmit={handleSubmit}>
        <h1 className="text-xl font-bold mb-4">Login CresceJá</h1>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <input
          className="border p-2 rounded w-full mb-2"
          type="email"
          placeholder="E-mail"
          value={credentials.email}
          onChange={e => setCredentials(c => ({ ...c, email: e.target.value }))}
        />
        <input
          className="border p-2 rounded w-full mb-4"
          type="password"
          placeholder="Senha"
          value={credentials.password}
          onChange={e => setCredentials(c => ({ ...c, password: e.target.value }))}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Entrar</button>
      </form>
    </div>
  );
}
