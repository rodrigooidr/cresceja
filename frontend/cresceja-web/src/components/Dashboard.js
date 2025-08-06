import React from 'react';

const Dashboard = ({ user }) => {
  return (
    <div>
      <h2>Bem-vindo, {user.name}!</h2>
      <p>Você está logado como <strong>{user.role}</strong></p>
    </div>
  );
};

export default Dashboard;