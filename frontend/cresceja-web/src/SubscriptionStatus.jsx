import React, { useEffect, useState } from 'react';
import axios from 'axios';

function SubscriptionStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  const fetchStatus = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/subscription/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
    } catch (err) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const startTrial = async () => {
    try {
      await axios.post('http://localhost:4000/api/subscription/start-trial', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchStatus();
    } catch (err) {
      alert('Erro ao iniciar teste gratuito.');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="main-container">
      <div className="content">
        <h2>Status da Assinatura</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : status ? (
          <>
            <p><b>Plano:</b> {status.plan}</p>
            <p><b>Válido até:</b> {new Date(status.trial_until || status.active_until).toLocaleDateString()}</p>
            {status.status === 'trial' && (
              <p><i>Você está em período de teste gratuito.</i></p>
            )}
          </>
        ) : (
          <div>
            <p>Você ainda não possui uma assinatura ativa.</p>
            <button onClick={startTrial}>Iniciar Teste Gratuito</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubscriptionStatus;