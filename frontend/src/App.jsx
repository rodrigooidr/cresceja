// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import AdminRoute from "./routes/AdminRoute";
import MainLayout from "./components/MainLayout";

// Páginas
import ChatPage from "./pages/Omnichannel/ChatPage";
import CRMPage from "./pages/CRM/CRMPage";
import CrmKanban from "./pages/CrmKanban";
import CrmOportunidades from "./pages/CrmOportunidades";
import PipelinePage from "./pages/PipelinePage";
import QualificacaoPage from "./pages/QualificacaoPage";
import LeadsPage from "./pages/LeadsPage";
import AgendaPage from "./pages/Agenda/AgendaPage";
import MarketingPage from "./pages/Marketing/MarketingPage";
import EditorIA from "./pages/Marketing/EditorIA";
import ApprovalPage from "./pages/Approvals/ApprovalPage";
import CreditsPage from "./pages/Credits/CreditsPage";
import GovernancePage from "./pages/Governance/GovernancePage";
import OnboardingPage from "./pages/Onboarding/OnboardingPage";

import CheckoutPage from "./pages/Billing/CheckoutPage";
import PaymentSuccess from "./pages/Billing/PaymentSuccess";
import PaymentError from "./pages/Billing/PaymentError";
import SubscriptionStatus from "./pages/Billing/SubscriptionStatus";

import AdminClients from "./pages/Admin/AdminClients";
import AdminPlans from "./pages/Admin/AdminPlans";
import AdminUsage from "./pages/Admin/AdminUsage";
import AdminIntegrations from "./pages/Admin/AdminIntegrations";
import AdminQuickReplies from "./pages/Admin/AdminQuickReplies";
import OwnerRoute from "./routes/OwnerRoute";

import TemplatesPage from "./pages/TemplatesPage";
import LGPDPage from "./pages/LGPDPage";
import LoginPage from "./pages/Auth/LoginPage";
import RegisterPage from "./pages/Auth/RegisterPage";
import DebugOverlay from "./components/DebugOverlay";

/** --------- Guards --------- **/
function isAuthenticated() {
  return Boolean(localStorage.getItem("token"));
}

// Redireciona para /login se não autenticado, preservando a rota original
function RequireAuth({ children }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// Evita acessar /login e /register se já estiver autenticado
function PublicOnly({ children }) {
  if (isAuthenticated()) {
    return <Navigate to="/crm/oportunidades" replace />;
  }
  return children;
}

// Aplica layout somente nas páginas protegidas
function Protected({ children }) {
  return (
    <RequireAuth>
      <MainLayout>{children}</MainLayout>
    </RequireAuth>
  );
}

/** --------- App --------- **/
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<LandingPage />} />
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
        <Route path="/lgpd" element={<LGPDPage />} />
        <Route path="/whatsapp/templates" element={<TemplatesPage />} />

        {/* Protegidas (com layout) */}
        <Route path="/omnichannel/chat" element={<Protected><ChatPage /></Protected>} />
        <Route path="/crm" element={<Protected><CRMPage /></Protected>} />
        <Route path="/crm/kanban" element={<Protected><CrmKanban /></Protected>} />
        <Route path="/crm/oportunidades" element={<Protected><CrmOportunidades /></Protected>} />
        <Route path="/crm/pipeline" element={<Protected><PipelinePage /></Protected>} />
        <Route path="/crm/qualificacao" element={<Protected><QualificacaoPage /></Protected>} />
        <Route path="/crm/leads" element={<Protected><LeadsPage /></Protected>} />
        <Route path="/agenda" element={<Protected><AgendaPage /></Protected>} />
        <Route path="/marketing" element={<Protected><MarketingPage /></Protected>} />
        <Route path="/marketing/editor" element={<Protected><EditorIA /></Protected>} />
        <Route path="/aprovacao" element={<Protected><ApprovalPage /></Protected>} />
        <Route path="/creditos" element={<Protected><CreditsPage /></Protected>} />
        <Route path="/governanca" element={<Protected><GovernancePage /></Protected>} />
        <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
        <Route path="/assinatura/status" element={<Protected><SubscriptionStatus /></Protected>} />

        {/* Admin (se usar route nesting, seu MainLayout precisa renderizar <Outlet />) */}
        <Route element={<AdminRoute><MainLayout /></AdminRoute>}>
          <Route element={<OwnerRoute />}>
            <Route path="/admin/clients" element={<AdminClients />} />
          </Route>
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/usage" element={<AdminUsage />} />
          <Route path="/admin/integrations" element={<AdminIntegrations />} />
          <Route path="/admin/quick-replies" element={<AdminQuickReplies />} />
        </Route>

        {/* Checkout público */}
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<PaymentSuccess />} />
        <Route path="/checkout/error" element={<PaymentError />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Debug na tela (somente se você criou esse componente) */}
      <DebugOverlay />
    </Router>
  );
}
