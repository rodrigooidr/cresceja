import React from 'react';

export default function UrgentBadge({ title = 'Atendimento humano solicitado' }) {
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        background: '#e11d48', // vermelho
        borderRadius: '50%',
        marginLeft: 6,
        boxShadow: '0 0 0 2px rgba(225,29,72,0.2)',
      }}
    />
  );
}
