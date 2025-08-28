import { useEffect, useState } from 'react';

let listeners = [];

export function useToasts() {
  return {
    addToast: (t) => {
      listeners.forEach((fn) => fn(t));
    },
  };
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((s) => [...s, { ...t, id }]);
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id));
      }, 3000);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((fn) => fn !== handler);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
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
