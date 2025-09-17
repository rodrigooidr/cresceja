import React from 'react';

export default function HandoffBanner({ show, onAck }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        background: '#fee2e2',
        color: '#7f1d1d',
        padding: '8px 12px',
        border: '1px solid #fecaca',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '8px 8px 0',
      }}
    >
      <strong>⚠ Atendimento humano solicitado</strong>
      <span style={{ opacity: 0.8 }}>Responda o cliente e confirme para remover o alerta.</span>
      <button
        onClick={onAck}
        style={{
          marginLeft: 'auto',
          background: '#ef4444',
          color: '#fff',
          border: 0,
          borderRadius: 6,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        Confirmar (ACK)
      </button>
    </div>
  );
}
