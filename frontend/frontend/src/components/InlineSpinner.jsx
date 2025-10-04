import React from 'react';

export default function InlineSpinner({ size = '1rem', className = '', label = 'Carregando…' }) {
  const style = { width: size, height: size };
  return (
    <span className={`inline-flex items-center ${className}`} role="status" aria-label={label}>
      <span
        className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
        style={style}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
