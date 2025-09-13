import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';

export default function PlansAdminPage() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await inboxApi.get('admin/plans', { meta: { scope: 'global' } });
        const list = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setItems(list);
      } catch (e) {
        setErr('Endpoint indisponível. Mostrando placeholder.');
        setItems([]);
      }
    })();
  }, []);

  if (!items) return <div className="p-6">Carregando…</div>;
  if (err) return <div className="p-6 text-amber-600">{err}</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Planos (Admin)</h1>
      {items.length === 0 ? (
        <div className="rounded border p-4">Nenhum plano encontrado.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id || p.name} className="rounded border p-4">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm opacity-70">
                Preço (centavos): {p.price_cents ?? p.price ?? 0}
              </div>
              <div className="text-sm opacity-70">
                Trial (dias): {p.trial_days ?? 0}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
