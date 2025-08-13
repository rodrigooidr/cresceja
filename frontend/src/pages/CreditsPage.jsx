
import React, { useEffect, useState } from 'react';
import { api } from '../api/axios';

export default function CreditsPage(){
  const [status, setStatus] = useState(null);
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    (async()=>{
      try{
        const [credits, subscription] = await Promise.all([
          api.get('/ai-credits/status'),
          api.get('/subscription/status')
        ]);
        setStatus(credits.data);
        setSub(subscription.data);
      } finally {
        setLoading(false);
      }
    })();
  },[]);

  const startTrial = async () => {
    await api.post('/subscription/start-trial');
    const subscription = await api.get('/subscription/status');
    setSub(subscription.data);
  };

  if(loading) return <p>Carregando…</p>;
  return (
    <div style={{maxWidth: 720, margin: '0 auto'}}>
      <h2>Créditos de IA</h2>
      <pre>{JSON.stringify(status, null, 2)}</pre>

      <h3>Assinatura</h3>
      {!sub || sub.status === 'no_subscription' ? (
        <button onClick={startTrial}>Iniciar teste grátis de 14 dias</button>
      ) : (
        <div>
          <p>Plano: <b>{sub.plan}</b> — Status: <b>{sub.status}</b></p>
          {sub.trial_days_left > 0 && <p>Seu teste termina em {sub.trial_days_left} dia(s).</p>}
        </div>
      )}
    </div>
  );
}
