import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const ToastContext = createContext({ addToast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const addToast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const life = Math.max(1500, opts.life || 3000);
    setItems((prev) => [...prev, { id, msg }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), life);
  }, []);

  const api = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-3 right-3 space-y-2 z-50">
        {items.map((t) => (
          <div key={t.id} className="px-3 py-2 rounded bg-gray-900 text-white shadow">
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts() {
  return useContext(ToastContext);
}

export default function ToastHost() {
  // Mantido apenas como alias para compatibilidade (Provider já renderiza os toasts)
  return null;
}
