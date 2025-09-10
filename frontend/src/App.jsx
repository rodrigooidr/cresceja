// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppShell from './ui/layout/AppShell';
import ToastHost, { useToasts } from './components/ToastHost.jsx';
import { RequireOrg, AdminRoute } from './routes/guards.jsx';

import InboxPage from './pages/inbox/InboxPage.jsx';
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
import AdminOrgsList from './pages/admin/AdminOrgsList.jsx';
import AdminOrgDetails from './pages/admin/AdminOrgDetails.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PlansAdmin from './pages/admin/PlansAdmin.jsx';

const ROLE_ORDER = ['Viewer', 'Agent', 'Manager', 'OrgOwner', 'Support', 'SuperAdmin'];

const normalizeRole = (role) => {
  if (!role) return null;
  const k = String(role).trim().toLowerCase().replace(/[\s_-]/g, '');
  const map = {
    viewer: 'Viewer',
    agente: 'Agent',
    agent: 'Agent',
    manager: 'Manager',
    supervisor: 'Manager',
    owner: 'OrgOwner',
    orgowner: 'OrgOwner',
    orgadmin: 'OrgOwner',
    admin: 'OrgOwner',
    superadmin: 'SuperAdmin',
    superadministrator: 'SuperAdmin',
    support: 'Support',
  };
  return map[k] || null;
};

const hasRole = (userRole, minRole) => {
  const u = ROLE_ORDER.indexOf(normalizeRole(userRole));
  const m = ROLE_ORDER.indexOf(minRole);
  if (u === -1 || m === -1) return false;
  return u >= m;
};

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireRole({ children, minRole }) {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  // SuperAdmin sempre pode
  if (role === 'SuperAdmin') return children;

  if (!hasRole(role, minRole)) {
    return <Navigate to="/app/forbidden" replace />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/app" replace /> : children;
}

function Placeholder({ label }) {
  return <div className="p-4">{label}</div>;
}

export default function App() {
  const { addToast } = useToasts();
  return (
    <Router>
      <ToastHost />
      <Routes>
        {/* Público (sem Sidebar/AppShell) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

        {/* App autenticado: usa AppShell como layout (Sidebar + <Outlet />) */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <RequireOrg>
                <AppShell />
              </RequireOrg>
            </RequireAuth>
          }
        >
          <Route index element={<Placeholder label="Bem-vindo(a) 👋" />} />

          <Route
            path="inbox"
            element={
              <RequireRole minRole="Agent">
                <InboxPage addToast={addToast} />
              </RequireRole>
            }
          />

          <Route path="content/calendar"      element={<RequireRole minRole="Agent"><ContentCalendar /></RequireRole>} />
          <Route path="calendars"             element={<RequireRole minRole="Agent"><ActivitiesPage /></RequireRole>} />
          <Route path="marketing"             element={<RequireRole minRole="Agent"><MarketingHome /></RequireRole>} />
          <Route path="marketing/lists"       element={<RequireRole minRole="Agent"><ListsPage /></RequireRole>} />
          <Route path="marketing/templates"   element={<RequireRole minRole="Agent"><TemplatesPage /></RequireRole>} />
          <Route path="marketing/campaigns"   element={<RequireRole minRole="Manager"><CampaignsPage /></RequireRole>} />
          <Route path="marketing/automations" element={<RequireRole minRole="Manager"><AutomationsPage /></RequireRole>} />

          <Route path="settings/channels"     element={<RequireRole minRole="Manager"><ChannelsPage /></RequireRole>} />
          <Route path="settings/users"        element={<RequireRole minRole="Manager"><Placeholder label="Settings Users" /></RequireRole>} />
          <Route path="settings/permissions"  element={<RequireRole minRole="Manager"><Placeholder label="Settings Permissions" /></RequireRole>} />
          <Route path="settings/plan"         element={<RequireRole minRole="OrgOwner"><Placeholder label="Settings Plan" /></RequireRole>} />

          <Route path="forbidden" element={<Placeholder label="Acesso negado" />} />
        </Route>

        {/* Admin autenticado */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminRoute>
                <AppShell />
              </AdminRoute>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="orgs" replace />} />
          <Route path="orgs" element={<RequireRole minRole="Support"><AdminOrgsList /></RequireRole>} />
          <Route path="orgs/:id" element={<RequireRole minRole="Support"><AdminOrgDetails /></RequireRole>} />
          <Route path="billing" element={<RequireRole minRole="SuperAdmin"><BillingPage /></RequireRole>} />
          <Route path="plans" element={<RequireRole minRole="SuperAdmin"><PlansAdmin /></RequireRole>} />
          <Route path="support" element={<RequireRole minRole="SuperAdmin"><Placeholder label="Admin Support" /></RequireRole>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
