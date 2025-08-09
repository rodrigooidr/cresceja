import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { AuthProvider } from './contexts/AuthContext';
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


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
		  <Route path="/" element={<LandingPage />} />
		  <Route path="/crm/oportunidades" element={<CrmOportunidades />} />
		  <Route path="/crm/kanban" element={<CrmKanban />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={
            <PrivateRoute><MainLayout><ChatPage /></MainLayout></PrivateRoute>
          } />
          <Route path="/crm" element={
            <PrivateRoute><MainLayout><CRMPage /></MainLayout></PrivateRoute>
          } />
          <Route path="/agenda" element={
            <PrivateRoute><MainLayout><AgendaPage /></MainLayout></PrivateRoute>
          } />
          <Route path="/marketing" element={
            <PrivateRoute><MainLayout><MarketingPage /></MainLayout></PrivateRoute>
          } />
          <Route path="/marketing/editor" element={
            <PrivateRoute><MainLayout><EditorIA /></MainLayout></PrivateRoute>
          } />
          <Route path="/aprovacao" element={
            <PrivateRoute><MainLayout><ApprovalPage /></MainLayout></PrivateRoute>
          } />
          <Route path="/creditos" element={
            <PrivateRoute><MainLayout><CreditsPage /></MainLayout></PrivateRoute>
          } />
          <Route path="/governanca" element={
            <PrivateRoute><MainLayout><GovernancePage /></MainLayout></PrivateRoute>
          } />
          <Route path="/onboarding" element={
            <PrivateRoute><MainLayout><OnboardingPage /></MainLayout></PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;