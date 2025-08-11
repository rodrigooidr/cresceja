import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const menu = [
  { path: '/', label: 'Atendimento' },
  { path: '/crm', label: 'CRM' },
  { path: '/agenda', label: 'Agenda' },
  { path: '/marketing', label: 'Marketing' },
  { path: '/aprovacao', label: 'Aprovações' },
  { path: '/creditos', label: 'Créditos IA' },
  { path: '/governanca', label: 'Governança' },
  { path: '/onboarding', label: 'Onboarding' },
];

function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className="w-52 bg-white shadow h-screen p-4 space-y-4 fixed left-0 top-0 overflow-y-auto"
      role="navigation"
      aria-label="Menu lateral"
    >
      <h1 className="text-xl font-bold">CresceJá</h1>

      <nav className="flex flex-col space-y-2">
        {menu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'} // evita que "/" fique sempre ativo
            className={({ isActive }) =>
              `text-sm rounded px-2 py-1 transition-colors ${
                isActive
                  ? 'font-bold text-blue-700 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}

        <button
          type="button"
          className="text-sm text-red-600 text-left mt-6 hover:underline"
          onClick={handleLogout}
        >
          Sair
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;
