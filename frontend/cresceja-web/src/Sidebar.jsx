import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation(); // <-- necessário para saber qual rota está ativa

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const linkStyle = (path) => ({
    display: 'block',
    padding: '10px 15px',
    textDecoration: 'none',
    color: isActive(path) ? '#fff' : '#ddd',
    backgroundColor: isActive(path) ? '#2c3e50' : 'transparent',
    borderRadius: '5px',
    marginBottom: '8px'
  });

  return (
    <div style={{
      width: '220px',
      minHeight: '100vh',
      backgroundColor: '#1a252f',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>CresceJá</h2>
      <nav>
        <Link to="/" style={linkStyle('/')}>Dashboard</Link>
        <Link to="/clientes" style={linkStyle('/clientes')}>Clientes</Link>
        <Link to="/novo-cliente" style={linkStyle('/novo-cliente')}>Novo Cliente</Link>
        <Link to="/perfil" style={linkStyle('/perfil')}>Perfil</Link>
        <Link to="/assinatura" style={linkStyle('/assinatura')}>Assinatura</Link>
        <Link to="/criar-usuario" style={linkStyle('/criar-usuario')}>Novo Usuário</Link>
        <button
          onClick={handleLogout}
          style={{
            marginTop: '20px',
            padding: '10px 15px',
            backgroundColor: '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Sair
        </button>
      </nav>
    </div>
  );
}

export default Sidebar;