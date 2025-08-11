import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';

import PrivateRoute from './contexts/PrivateRoute';
import MainLayout from './components/MainLayout';

import CrmKanban from './pages/CrmKanban';
import ChatPage from './pages/Omnichannel/ChatPage';
import CRMPage from './pages/CRM/CRMPage';
import AgendaPage from './pages/Agenda/AgendaPage';
import MarketingPage from './pages/Marketing/MarketingPage';
import EditorIA from './pages/Marketing/EditorIA';
import ApprovalPage from './pages/Approvals/ApprovalPage';
import CreditsPage from './pages/Credits/CreditsPage';
import GovernancePage from './pages/Governance/GovernancePage';
import OnboardingPage from './pages/Onboarding/OnboardingPage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import CrmOportunidades from './pages/CrmOportunidades';
import LGPDPage from './pages/LGPDPage';
import TemplatesPage from './pages/TemplatesPage';

// 🔎 Redireciona pela role: se logado e não-admin => /omnichannel; admin/owner => /governanca
/*import { useAuth } from './contexts/AuthContext';
function SmartHome() {
  const { currentUser } = useAuth?.() || {};
  // se não estiver logado, mostra a landing normalmente
  if (!currentUser) return <LandingPage />;

  const role = currentUser.role || 'operator';
  const isAdmin = role === 'admin' || currentUser.is_owner === true;
  return <Navigate to={isAdmin ? '/governanca' : '/omnichannel'} replace />;
}
*/
function Protected({ children }) {
  return (
    <PrivateRoute>
      <MainLayout>{children}</MainLayout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lgpd" element={<LGPDPage />} />
        <Route path="/whatsapp/templates" element={<TemplatesPage />} />

        {/* Protegidas */}
        <Route path="/omnichannel/chat" element={<Protected><ChatPage /></Protected>} />
        <Route path="/crm" element={<Protected><CRMPage /></Protected>} />
        <Route path="/crm/kanban" element={<Protected><CrmKanban /></Protected>} />
        <Route path="/crm/oportunidades" element={<Protected><CrmOportunidades /></Protected>} />
        <Route path="/agenda" element={<Protected><AgendaPage /></Protected>} />
        <Route path="/marketing" element={<Protected><MarketingPage /></Protected>} />
        <Route path="/marketing/editor" element={<Protected><EditorIA /></Protected>} />
        <Route path="/aprovacao" element={<Protected><ApprovalPage /></Protected>} />
        <Route path="/creditos" element={<Protected><CreditsPage /></Protected>} />
        <Route path="/governanca" element={<Protected><GovernancePage /></Protected>} />
        <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}