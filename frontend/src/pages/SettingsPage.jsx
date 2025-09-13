import FeatureGate from '../ui/feature/FeatureGate';
import inboxApi from '../api/inboxApi.js';
import { useOrg } from '../contexts/OrgContext.jsx';
import { useEffect, useState } from 'react';
import { mapApiErrorToForm } from '../ui/errors/mapApiError.js';

function GoogleCalendarSection() {
  const { selected } = useOrg();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limitInfo, setLimitInfo] = useState({ used: 0, limit: null });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [list, features] = await Promise.all([
          inboxApi.get(`/orgs/${selected}/calendar/accounts`, { meta: { scope: 'global' } }),
          inboxApi.get(`/orgs/${selected}/features`, { meta: { scope: 'global' } }),
        ]);
        if (!isMounted) return;
        setItems(list.data || []);
        const f = features.data?.google_calendar_accounts || {};
        setLimitInfo({ used: f.used ?? 0, limit: f.limit ?? null });
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (selected) load();
    return () => { isMounted = false; };
  }, [selected]);

  const canAdd = limitInfo.limit == null || limitInfo.used < limitInfo.limit;

  async function handleAddMock() {
    setSaving(true);
    try {
      const body = {
        google_user_id: crypto.randomUUID(),
        email: `user${Date.now()}@example.com`,
        display_name: 'Conta Google (mock)',
      };
      await inboxApi.post(`/orgs/${selected}/calendar/accounts`, body, { meta: { scope: 'global' } });
      const list = await inboxApi.get(`/orgs/${selected}/calendar/accounts`, { meta: { scope: 'global' } });
      setItems(list.data || []);
      setLimitInfo(prev => ({ ...prev, used: (prev.used ?? 0) + 1 }));
    } catch (err) {
      mapApiErrorToForm(err, () => {});
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    try {
      await inboxApi.delete(`/orgs/${selected}/calendar/accounts/${id}`, { meta: { scope: 'global' } });
      setItems(prev => prev.filter(x => x.id !== id));
      setLimitInfo(prev => ({ ...prev, used: Math.max(0, (prev.used ?? 1) - 1) }));
    } catch (err) {
      mapApiErrorToForm(err, () => {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Google Calendar</h3>
        <div className="text-sm opacity-75">Usados: {limitInfo.used} / {limitInfo.limit ?? '∞'}</div>
      </div>

      {loading ? (
        <div className="mt-3 text-sm opacity-70">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded border p-3 text-sm">
          Nenhuma conta conectada.
          <div className="mt-2">
            <button className="btn btn-primary" onClick={handleAddMock} disabled={!canAdd || saving}>
              Conectar conta
            </button>
            {!canAdd && <span className="ml-2 text-red-600">Limite do plano atingido</span>}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map(acc => (
            <div key={acc.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{acc.display_name || acc.email || acc.google_user_id}</div>
                <div className="text-xs opacity-70">{acc.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">{acc.is_active ? 'Ativo' : 'Inativo'}</span>
                <button className="btn btn-outline" onClick={() => handleDelete(acc.id)} disabled={saving}>
                  Remover
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <button className="btn btn-primary" onClick={handleAddMock} disabled={!canAdd || saving}>
              Adicionar outra conta
            </button>
            {!canAdd && <span className="ml-2 text-red-600 text-sm">Limite do plano atingido</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-4 space-y-8">
      <FeatureGate code="google_calendar_accounts" fallback={null}>
        <GoogleCalendarSection />
      </FeatureGate>
    </div>
  );
}
