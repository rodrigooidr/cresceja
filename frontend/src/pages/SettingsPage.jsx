import inboxApi from '../api/inboxApi.js';
import { useOrg } from '../contexts/OrgContext.jsx';
import { useCallback, useEffect, useState } from 'react';
import { mapApiErrorToForm } from '../ui/errors/mapApiError.js';
import useToastFallback from '../hooks/useToastFallback.js';
import { canUse } from '../utils/featureGate.js';

function GoogleCalendarSection(props) {
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
    <section className="mb-8" data-testid={props['data-testid']}>
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
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving} data-testid="calendar-connect">
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
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving} data-testid="calendar-connect">
              {saving ? 'Redirecionando…' : 'Adicionar outra conta'}
            </button>
            {!canAdd && <span className="ml-2 text-red-600 text-sm">Limite do plano atingido</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function FacebookSection(props) {
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
        inboxApi.get(`/orgs/${selected}/facebook/pages`, { meta: { scope: 'global' } }),
        inboxApi.get(`/orgs/${selected}/features`, { meta: { scope: 'global' } }),
      ]);
      setItems(list.data || []);
      const f = features.data?.facebook_pages || {};
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
    if (params.get('fb_connected') === '1') {
      toast({ title: 'Página conectada' });
      params.delete('fb_connected');
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', newUrl);
      load();
    }
  }, [toast, load]);

  const canAdd = limitInfo.limit == null || limitInfo.used < limitInfo.limit;

  function handleConnect() {
    setSaving(true);
    const url = `/api/auth/facebook/start?orgId=${selected}&returnTo=/settings`;
    window.location.href = url;
  }

  async function handleRemove(id) {
    setSaving(true);
    try {
      await inboxApi.delete(`/orgs/${selected}/facebook/pages/${id}`, { meta: { scope: 'global' } });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast({ title: 'Página removida' });
    } catch (err) {
      mapApiErrorToForm(err, () => {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8" data-testid={props['data-testid']}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Facebook</h3>
        <div className="text-sm opacity-75">Usados: {limitInfo.used} / {limitInfo.limit ?? '∞'}</div>
      </div>

      {loading ? (
        <div className="mt-3 text-sm opacity-70">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded border p-3 text-sm">
          Nenhuma página conectada.
          <div className="mt-2">
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving} data-testid="facebook-connect">
              {saving ? 'Redirecionando…' : 'Conectar página'}
            </button>
            {!canAdd && <span className="ml-2 text-red-600">Limite do plano atingido</span>}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{p.name || p.page_id}</div>
                <div className="text-xs opacity-70">{p.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">{p.is_active ? 'Ativa' : 'Inativa'}</span>
                <button className="btn btn-outline" onClick={() => handleRemove(p.id)} disabled={saving}>
                  Remover
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving} data-testid="facebook-connect">
              {saving ? 'Redirecionando…' : 'Adicionar outra página'}
            </button>
            {!canAdd && <span className="ml-2 text-red-600 text-sm">Limite do plano atingido</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function InstagramSection(props) {
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
        inboxApi.get(`/orgs/${selected}/instagram/accounts`, { meta: { scope: 'global' } }),
        inboxApi.get(`/orgs/${selected}/features`, { meta: { scope: 'global' } }),
      ]);
      setItems(list.data || []);
      const f = features.data?.instagram_accounts || {};
      setLimitInfo({ used: f.used ?? 0, limit: f.limit ?? null });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { if (selected) load(); }, [selected, load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ig_connected') === '1') {
      toast({ title: 'Conta conectada' });
      params.delete('ig_connected');
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', newUrl);
      load();
    }
  }, [toast, load]);

  const canAdd = limitInfo.limit == null || limitInfo.used < limitInfo.limit;

  function handleConnect() {
    setSaving(true);
    const url = `/api/auth/instagram/start?orgId=${selected}&returnTo=/settings`;
    window.location.href = url;
  }

  async function handleRemove(id) {
    setSaving(true);
    try {
      await inboxApi.delete(`/orgs/${selected}/instagram/accounts/${id}`, { meta: { scope: 'global' } });
      setItems(prev => prev.filter(x => x.id !== id));
      toast({ title: 'Conta removida' });
    } catch (err) { mapApiErrorToForm(err, () => {}); }
    finally { setSaving(false); }
  }

  return (
    <section className="mb-8" data-testid={props['data-testid']}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Instagram</h3>
        <div className="text-sm opacity-75">Usados: {limitInfo.used} / {limitInfo.limit ?? '∞'}</div>
      </div>
      {loading ? (
        <div className="mt-3 text-sm opacity-70">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded border p-3 text-sm">
          Nenhuma conta conectada.
          <div className="mt-2">
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving} data-testid="instagram-connect">
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
                <div className="font-medium">{acc.username || acc.ig_user_id}</div>
                <div className="text-xs opacity-70">{acc.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">{acc.is_active ? 'Ativa' : 'Inativa'}</span>
                <button className="btn btn-outline" onClick={() => handleRemove(acc.id)} disabled={saving}>Remover</button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <button className="btn btn-primary" onClick={handleConnect} disabled={!canAdd || saving} data-testid="instagram-connect">
              {saving ? 'Redirecionando…' : 'Adicionar outra conta'}
            </button>
            {!canAdd && <span className="ml-2 text-red-600 text-sm">Limite do plano atingido</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function WhatsAppSection(props) {
  return (
    <section className="mb-8" data-testid={props['data-testid']}>
      <h3 className="text-lg font-semibold">WhatsApp</h3>
    </section>
  );
}
export default function SettingsPage() {
  const { selected } = useOrg();
  const [org, setOrg] = useState(null);

  useEffect(() => {
    let active = true;
    if (!selected) return;
    inboxApi.get('/orgs/current', { meta: { scope: 'global' } }).then((res) => {
      if (active) setOrg(res.data);
    });
    return () => {
      active = false;
    };
  }, [selected]);

  const showCalendar = canUse(org, 'calendar', 'calendar');
  const showFacebook = canUse(org, 'facebook', 'facebook_pages');
  const showInstagram = canUse(org, 'instagram', 'instagram_accounts');
  const showWhatsApp = canUse(org, 'whatsapp', 'wa_numbers');

  return (
    <div className="p-4 space-y-8">
      {showCalendar ? (
        <GoogleCalendarSection data-testid="settings-calendar-section" />
      ) : null}
      {showFacebook ? (
        <FacebookSection data-testid="settings-facebook-section" />
      ) : null}
      {showInstagram ? (
        <InstagramSection data-testid="settings-instagram-section" />
      ) : null}
      {showWhatsApp ? (
        <WhatsAppSection data-testid="settings-whatsapp-section" />
      ) : null}
    </div>
  );
}
