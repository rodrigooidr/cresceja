import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import MainLayout from './components/MainLayout';
import InboxPage from './pages/inbox/InboxPage.jsx';
import ChannelsPage from './pages/settings/ChannelsPage.jsx';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import { useAuth } from './contexts/AuthContext';
import ContentCalendar from './pages/calendar/ContentCalendar.jsx';
import ActivitiesPage from './pages/calendar/ActivitiesPage.jsx';
import MarketingHome from './pages/Marketing/MarketingHome.jsx';
import ListsPage from './pages/Marketing/ListsPage.jsx';
import TemplatesPage from './pages/Marketing/TemplatesPage.jsx';
import CampaignsPage from './pages/Marketing/CampaignsPage.jsx';
import AutomationsPage from './pages/Marketing/AutomationsPage.jsx';
import BillingPage from './pages/Admin/BillingPage.jsx';

const roleOrder = ['Viewer', 'Agent', 'Manager', 'OrgOwner', 'SuperAdmin'];
const hasRole = (userRole, minRole) => {
  const u = roleOrder.indexOf(userRole);
  const m = roleOrder.indexOf(minRole);
  return u >= 0 && m >= 0 && u >= m;
};

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireRole({ children, minRole }) {
  const { user } = useAuth();
  if (!hasRole(user?.role, minRole)) return <Navigate to="/app" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/app" replace /> : children;
}

function Placeholder({ label }) {
  return <div className="p-4">{label}</div>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          }
        />

        <Route
          path="/app"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="inbox" replace />} />
          <Route
            path="inbox"
            element={
              <RequireRole minRole="Agent">
                  <InboxPage />
                </RequireRole>
            }
          />
          <Route
            path="crm/leads"
            element={
              <RequireRole minRole="Agent">
                <Placeholder label="CRM Leads" />
              </RequireRole>
            }
          />
          <Route
            path="crm/pipeline"
            element={
              <RequireRole minRole="Agent">
                <Placeholder label="CRM Pipeline" />
              </RequireRole>
            }
          />
          <Route
            path="crm/clients"
            element={
              <RequireRole minRole="Agent">
                <Placeholder label="CRM Clients" />
              </RequireRole>
            }
          />
          <Route
            path="crm/onboarding"
            element={
              <RequireRole minRole="Agent">
                <Placeholder label="CRM Onboarding" />
              </RequireRole>
            }
          />
          <Route
            path="crm/nps"
            element={
              <RequireRole minRole="Manager">
                <Placeholder label="CRM NPS" />
              </RequireRole>
            }
          />
          <Route
            path="content/studio"
            element={
              <RequireRole minRole="Agent">
                <Placeholder label="Content Studio" />
              </RequireRole>
            }
          />
          <Route
            path="content/calendar"
            element={
              <RequireRole minRole="Agent">
                <ContentCalendar />
              </RequireRole>
            }
          />
          <Route
            path="marketing"
            element={
              <RequireRole minRole="Agent">
                <MarketingHome />
              </RequireRole>
            }
          />
          <Route
            path="marketing/lists"
            element={
              <RequireRole minRole="Agent">
                <ListsPage />
              </RequireRole>
            }
          />
          <Route
            path="marketing/templates"
            element={
              <RequireRole minRole="Agent">
                <TemplatesPage />
              </RequireRole>
            }
          />
          <Route
            path="marketing/campaigns"
            element={
              <RequireRole minRole="Manager">
                <CampaignsPage />
              </RequireRole>
            }
          />
          <Route
            path="marketing/automations"
            element={
              <RequireRole minRole="Manager">
                <AutomationsPage />
              </RequireRole>
            }
          />
            <Route
              path="calendars"
              element={
                <RequireRole minRole="Agent">
                  <ActivitiesPage />
                </RequireRole>
              }
            />
          <Route
            path="reports"
            element={
              <RequireRole minRole="Manager">
                <Placeholder label="Reports" />
              </RequireRole>
            }
          />
          <Route
            path="settings/users"
            element={
              <RequireRole minRole="Manager">
                <Placeholder label="Settings Users" />
              </RequireRole>
            }
          />
          <Route
            path="settings/channels"
            element={
              <RequireRole minRole="Manager">
                  <ChannelsPage />
                </RequireRole>
            }
          />
          <Route
            path="settings/permissions"
            element={
              <RequireRole minRole="Manager">
                <Placeholder label="Settings Permissions" />
              </RequireRole>
            }
          />
          <Route
            path="settings/plan"
            element={
              <RequireRole minRole="OrgOwner">
                <Placeholder label="Settings Plan" />
              </RequireRole>
            }
          />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="orgs" replace />} />
          <Route
            path="orgs"
            element={
              <RequireRole minRole="SuperAdmin">
                <Placeholder label="Admin Orgs" />
              </RequireRole>
            }
          />
          <Route
            path="billing"
            element={
              <RequireRole minRole="SuperAdmin">
                <BillingPage />
              </RequireRole>
            }
          />
          <Route
            path="support"
            element={
              <RequireRole minRole="SuperAdmin">
                <Placeholder label="Admin Support" />
              </RequireRole>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Router>
  );
}
