import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const menu = [
  { path: '/', label: 'Atendimento' },
  { path: '/crm', label: 'CRM' },
  { path: '/agenda', label: 'Agenda' },
  { path: '/marketing', label: 'Marketing' },
  { path: '/aprovacao', label: 'Aprovações' },
  { path: '/creditos', label: 'Créditos IA' },
  { path: '/governanca', label: 'Governança' },
  { path: '/onboarding', label: 'Onboarding' }
];

function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-48 bg-white shadow h-screen p-4 space-y-4 fixed">
      <h2 className="text-xl font-bold">CresceJá</h2>
      <nav className="flex flex-col space-y-2">
        {menu.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={\`text-sm \${pathname === item.path ? 'font-bold text-blue-600' : 'text-gray-700'}\`}
          >
            {item.label}
          </Link>
        ))}
        <button
          className="text-sm text-red-600 text-left mt-6"
          onClick={handleLogout}
        >
          Sair
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;