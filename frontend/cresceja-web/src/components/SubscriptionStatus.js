import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SubscriptionStatus = () => {
  const [status, setStatus] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('http://localhost:4000/api/subscription/status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStatus(response.data);
      } catch (err) {
        setStatus({ active: false });
      }
    };
    fetchStatus();
  }, [token]);

  if (!status) return <p>Carregando...</p>;

  return (
    <div>
      {status.active ? (
        <p style={{ color: 'green' }}>Plano ativo até {new Date(status.expiresAt).toLocaleDateString()}</p>
      ) : (
        <p style={{ color: 'red' }}>Nenhum plano ativo</p>
      )}
    </div>
  );
};

export default SubscriptionStatus;