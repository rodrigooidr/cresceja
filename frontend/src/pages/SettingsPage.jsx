import FeatureGate from '../ui/feature/FeatureGate';
import inboxApi from '../api/inboxApi.js';
import { useOrg } from '../contexts/OrgContext.jsx';
import { useCallback, useEffect, useState } from 'react';
import { mapApiErrorToForm } from '../ui/errors/mapApiError.js';
import useToastFallback from '../hooks/useToastFallback.js';

function GoogleCalendarSection() {
  const { selected } = useOrg();
  const toast = useToastFallback();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limitInfo, setLimitInfo] = useState({ used: 0, limit: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, features] = await Promise.all([
        inboxApi.get(`/orgs/${selected}/calendar/accounts`, { meta: { scope: 'global' } }),
        inboxApi.get(`/orgs/${selected}/features`, { meta: { scope: 'global' } }),
      ]);
      setItems(list.data || []);
      const f = features.data?.google_calendar_accounts || {};
      setLimitInfo({ used: f.used ?? 0, limit: f.limit ?? null });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    load();
  }, [selected, load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast({ title: 'Conta conectada' });
      params.delete('connected');
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', newUrl);
      load();
    }
  }, [toast, load]);

  const canAdd = limitInfo.limit == null || limitInfo.used < limitInfo.limit;

  function handleConnect() {
    setSaving(true);
    const url = `/api/auth/google/start?orgId=${selected}&returnTo=/settings`;
    window.location.href = url;
  }

  async function handleRefresh(id) {
    setSaving(true);
    try {
      const { data } = await inboxApi.post(`/orgs/${selected}/calendar/accounts/${id}/refresh`, null, { meta: { scope: 'global' } });
      if (data?.expiry) toast({ title: 'Token atualizado', description: new Date(data.expiry).toLocaleString() });
    } catch (err) {
      mapApiErrorToForm(err, () => {});
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id) {
    setSaving(true);
    try {
      await inboxApi.post(`/orgs/${selected}/calendar/accounts/${id}/revoke`, null, { meta: { scope: 'global' } });
      setItems(prev => prev.filter(x => x.id !== id));
      toast({ title: 'Token revogado' });
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
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving}>
              {saving ? 'Redirecionando…' : 'Conectar conta'}
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
                <button className="btn btn-outline" onClick={() => handleRefresh(acc.id)} disabled={saving}>
                  Atualizar token
                </button>
                <button className="btn btn-outline" onClick={() => handleRevoke(acc.id)} disabled={saving}>
                  Revogar
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving}>
              {saving ? 'Redirecionando…' : 'Adicionar outra conta'}
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
