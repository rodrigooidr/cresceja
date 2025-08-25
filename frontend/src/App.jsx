// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import InboxPage from './pages/Inbox/InboxPage.jsx';
import ChannelsPage from './pages/settings/ChannelsPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import { useAuth } from './contexts/AuthContext';
import ContentCalendar from './pages/calendar/ContentCalendar.jsx';
import ActivitiesPage from './pages/calendar/ActivitiesPage.jsx';
import MarketingHome from './pages/marketing/MarketingHome.jsx';
import ListsPage from './pages/marketing/ListsPage.jsx';
import TemplatesPage from './pages/marketing/TemplatesPage.jsx';
import CampaignsPage from './pages/marketing/CampaignsPage.jsx';
import AutomationsPage from './pages/marketing/AutomationsPage.jsx';
import BillingPage from './pages/admin/BillingPage.jsx';
import LandingPage from './pages/LandingPage.jsx';

const roleOrder = ['Viewer', 'Agent', 'Manager', 'OrgOwner', 'SuperAdmin'];
const roleAlias = (r) => {
  if (!r) return r;
  const k = String(r).toLowerCase();
  const map = {
    owner: 'OrgOwner',
    orgowner: 'OrgOwner',
    agent: 'Agent',
    manager: 'Manager',
    viewer: 'Viewer',
    superadmin: 'SuperAdmin',
  };
  return map[k] || r;
};
const hasRole = (userRole, minRole) => {
  const u = roleOrder.indexOf(roleAlias(userRole));
  const m = roleOrder.indexOf(minRole);
  return u >= 0 && m >= 0 && u >= m;
};

function RequireAuth({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  // considera autenticado se existe token/usuário válidos
  if (!isAuthenticated && !user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireRole({ children, minRole }) {
  const { user } = useAuth();
  if (!hasRole(user?.role, minRole)) return <Navigate to="/app/forbidden" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { isAuthenticated, user } = useAuth();
  return (isAuthenticated || user) ? <Navigate to="/app" replace /> : children;
}

function Placeholder({ label }) {
  return <div className="p-4">{label}</div>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Público */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

        {/* App autenticado */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {/* Index seguro (NÃO redireciona). Evita loop quando papel não bate */}
          <Route index element={<Placeholder label="Bem-vindo(a) 👋" />} />

          <Route
            path="inbox"
            element={
              <RequireRole minRole="Agent">
                <InboxPage />
              </RequireRole>
            }
          />

          <Route path="content/calendar" element={<RequireRole minRole="Agent"><ContentCalendar /></RequireRole>} />
          <Route path="calendars"         element={<RequireRole minRole="Agent"><ActivitiesPage /></RequireRole>} />
          <Route path="marketing"         element={<RequireRole minRole="Agent"><MarketingHome /></RequireRole>} />
          <Route path="marketing/lists"   element={<RequireRole minRole="Agent"><ListsPage /></RequireRole>} />
          <Route path="marketing/templates" element={<RequireRole minRole="Agent"><TemplatesPage /></RequireRole>} />
          <Route path="marketing/campaigns" element={<RequireRole minRole="Manager"><CampaignsPage /></RequireRole>} />
          <Route path="marketing/automations" element={<RequireRole minRole="Manager"><AutomationsPage /></RequireRole>} />

          <Route path="settings/channels" element={<RequireRole minRole="Manager"><ChannelsPage /></RequireRole>} />
          <Route path="settings/users"    element={<RequireRole minRole="Manager"><Placeholder label="Settings Users" /></RequireRole>} />
          <Route path="settings/permissions" element={<RequireRole minRole="Manager"><Placeholder label="Settings Permissions" /></RequireRole>} />
          <Route path="settings/plan"     element={<RequireRole minRole="OrgOwner"><Placeholder label="Settings Plan" /></RequireRole>} />

          {/* Página de acesso negado */}
          <Route path="forbidden" element={<Placeholder label="Acesso negado" />} />
        </Route>

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="orgs" replace />} />
          <Route path="orgs"    element={<RequireRole minRole="SuperAdmin"><Placeholder label="Admin Orgs" /></RequireRole>} />
          <Route path="billing" element={<RequireRole minRole="SuperAdmin"><BillingPage /></RequireRole>} />
          <Route path="support" element={<RequireRole minRole="SuperAdmin"><Placeholder label="Admin Support" /></RequireRole>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
