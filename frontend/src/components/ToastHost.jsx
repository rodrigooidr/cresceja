import { useEffect, useState } from 'react';

let listeners = [];

export function useToasts() {
  return {
    addToast: (t) => {
      listeners.forEach((fn) => fn({ ...t, __op: 'add' }));
    },
    removeToast: (id) => {
      listeners.forEach((fn) => fn({ id, __op: 'remove' }));
    },
  };
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (evt) => {
      if (evt.__op === 'remove') {
        setToasts((s) => s.filter((x) => x.id !== evt.id));
        return;
      }
      const id = evt.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((s) => [...s, { ...evt, id }]);
      const ttl = evt.kind === 'error' ? 7000 : 4000;
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id));
      }, ttl);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((fn) => fn !== handler);
    };
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 space-y-2 z-50"
      role="status"
      aria-live="polite"
      data-testid="toast-host"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast-item"
          className={`px-3 py-2 rounded text-white shadow ${
            t.kind === 'error'
              ? 'bg-red-600'
              : t.kind === 'success'
              ? 'bg-green-600'
              : 'bg-gray-800'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
