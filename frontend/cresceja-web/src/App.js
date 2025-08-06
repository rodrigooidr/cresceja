import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './Login';
import Dashboard from './Dashboard';
import ClientList from './ClientList';
import ClientForm from './ClientForm';
import CreateUser from './CreateUser';
import Profile from './Profile';
import SubscriptionStatus from './SubscriptionStatus';

import PrivateRoute from './PrivateRoute';
import Sidebar from './Sidebar';

function LayoutWithSidebar({ children }) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Rota pública */}
        <Route path="/login" element={<Login />} />

        {/* Rotas protegidas com Sidebar */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <LayoutWithSidebar>
                <Dashboard />
              </LayoutWithSidebar>
            </PrivateRoute>
          }
        />

        <Route
          path="/clientes"
          element={
            <PrivateRoute>
              <LayoutWithSidebar>
                <ClientList />
              </LayoutWithSidebar>
            </PrivateRoute>
          }
        />

        <Route
          path="/novo-cliente"
          element={
            <PrivateRoute>
              <LayoutWithSidebar>
                <ClientForm />
              </LayoutWithSidebar>
            </PrivateRoute>
          }
        />

        <Route
          path="/criar-usuario"
          element={
            <PrivateRoute>
              <LayoutWithSidebar>
                <CreateUser />
              </LayoutWithSidebar>
            </PrivateRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <PrivateRoute>
              <LayoutWithSidebar>
                <Profile />
              </LayoutWithSidebar>
            </PrivateRoute>
          }
        />

        <Route
          path="/assinatura"
          element={
            <PrivateRoute>
              <LayoutWithSidebar>
                <SubscriptionStatus />
              </LayoutWithSidebar>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;