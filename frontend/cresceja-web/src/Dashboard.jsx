import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SubscriptionStatus from './SubscriptionStatus';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const [stats, setStats] = useState({ users: 0, lastLogin: '' });

  useEffect(() => {
    async function fetchStats() {
      if (user?.role === 'Admin') {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get('http://localhost:4000/api/users', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStats({ users: res.data.length, lastLogin: new Date().toLocaleString() });
        } catch {
          setStats({ users: 0, lastLogin: new Date().toLocaleString() });
        }
      } else {
        setStats({ users: 0, lastLogin: new Date().toLocaleString() });
      }
    }
    fetchStats();
  }, [user]);

  return (
    <div>
      <h2>Bem-vindo, {user?.name || 'usuário'}!</h2>
      <SubscriptionStatus />
      <div className="dashboard-cards">
        {user?.role === 'Admin' && (
          <div className="card">
            <h4>Total de Usuários</h4>
            <p>{stats.users}</p>
          </div>
        )}
        <div className="card">
          <h4>Último Login</h4>
          <p>{stats.lastLogin}</p>
        </div>
      </div>
      <div style={{ marginTop: 40 }}>
        <strong>Sistema CresceJá</strong> - Seu painel administrativo para gestão inteligente de PMEs!
      </div>
    </div>
  );
}

export default Dashboard;
