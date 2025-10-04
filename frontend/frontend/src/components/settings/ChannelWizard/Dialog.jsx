import React, { useEffect, useRef } from 'react';

function Dialog({ children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
      ref={ref}
    >
      <div data-testid="wizard-dialog" className="bg-white p-4 rounded">
        {children}
      </div>
    </div>
  );
}

export default Dialog;
