import React, { useEffect, useState } from 'react';

export default function ConectarCanais() {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [to, setTo] = useState('55');
  const [body, setBody] = useState('Olá do CresceJá!');
  const token = localStorage.getItem('token');

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const init = async () => {
    const res = await fetch('/api/test-whatsapp/init', { method: 'POST', headers });
    const data = await res.json();
    setStatus(data.status);
    setQr(data.qr);
  };

  const refreshStatus = async () => {
    const res = await fetch('/api/test-whatsapp/status', { headers });
    const data = await res.json();
    setStatus(data.status);
    setQr(data.qr);
  };

  const send = async () => {
    const res = await fetch('/api/test-whatsapp/send', {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, body })
    });
    const data = await res.json();
    alert(JSON.stringify(data));
  };

  return (
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 16 }}>
      <h2>Conectar Canais</h2>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3>WhatsApp Web (Baileys)</h3>
        <p>Status: {status?.isConnected ? 'Conectado' : 'Desconectado'}</p>
        {!status?.isConnected && (
          <button onClick={init}>Iniciar sessão</button>
        )}
        <button onClick={refreshStatus} style={{ marginLeft: 8 }}>Atualizar status</button>

        {qr && (
          <div style={{ marginTop: 12 }}>
            <p>Escaneie o QR Code abaixo:</p>
            <img src={qr} alt="QR Code WhatsApp" style={{ width: 256, height: 256 }} />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <input placeholder="55DDDNUMERO" value={to} onChange={e => setTo(e.target.value)} />
          <input placeholder="Mensagem" value={body} onChange={e => setBody(e.target.value)} style={{ marginLeft: 8 }} />
          <button onClick={send} style={{ marginLeft: 8 }}>Enviar</button>
        </div>
      </section>
    </div>
  );
}
