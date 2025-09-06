// src/ui/PopoverPortal.jsx
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PopoverPortal({ anchorEl, open, onClose, children, offset = 8 }) {
  const [style, setStyle] = useState({});
  const portalRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    // posicione acima do botão; ajuste se quiser para cima/baixo
    setStyle({
      position: 'fixed',
      top: r.top - offset,
      left: r.left,
      transform: 'translateY(-100%)', // acima
      zIndex: 60_000,
    });
  }, [open, anchorEl, offset]);

  if (!open) return null;

  return createPortal(
    <div
      ref={portalRef}
      style={style}
      className="rounded-xl border bg-white shadow-lg p-2 max-w-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
