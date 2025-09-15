import React, { useCallback, useEffect, useMemo, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';
import FeatureGate from '../../ui/feature/FeatureGate.jsx';
import { openOAuth } from '../../utils/oauthDriver.js';

const CHANNEL_LABEL = {
  facebook: 'Facebook',
  instagram: 'Instagram',
};

function normalizeItems(list, fallbackChannel) {
  return (Array.isArray(list) ? list : []).map((acc) => {
    const channel = acc.channel || fallbackChannel || null;
    const perms = Array.isArray(acc.permissions_json)
      ? acc.permissions_json
      : Array.isArray(acc.perms)
        ? acc.perms
        : [];
    return {
      ...acc,
      channel,
      permissions_json: perms,
    };
  });
}

function hasMessagingPerm(channel, perms) {
  const normalized = Array.isArray(perms)
    ? perms.map((p) => (typeof p === 'string' ? p.toLowerCase() : '')).filter(Boolean)
    : [];
  if (channel === 'instagram') {
    return (
      normalized.includes('instagram_manage_messages') ||
      normalized.includes('pages_messaging')
    );
  }
  return normalized.includes('pages_messaging');
}

function formatBoolean(value) {
  return value ? 'Sim' : 'Não';
}

export function MetaAccounts({ channel }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inboxApi.get('/channels/meta/accounts', { params: { channel } });
      setItems(normalizeItems(data?.items, channel));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = useCallback(async () => {
    setSaving(true);
    try {
      let payload = null;
      let result;
      try {
        await openOAuth({
          provider: 'facebook',
          url: '/oauth/facebook',
          onSuccess: (res) => { result = res; },
        });
      } catch (err) {
        // Popup bloqueado ou fluxo abortado — segue com modos alternativos
      }

      if (Array.isArray(result?.accounts) && result.accounts.length > 0) {
        payload = {
          accounts: result.accounts.map((acc) => ({
            ...acc,
            channel: acc.channel || channel,
          })),
        };
      } else if (result?.userAccessToken) {
        payload = { userAccessToken: result.userAccessToken };
      }

      if (!payload) return;

      await inboxApi.post('/channels/meta/accounts/connect', payload);
      await load();
    } finally {
      setSaving(false);
    }
  }, [channel, load]);

  const subscribe = useCallback(async (id) => {
    setSaving(true);
    try {
      await inboxApi.post(`/channels/meta/accounts/${id}/subscribe`);
      await load();
    } finally {
      setSaving(false);
    }
  }, [load]);

  const remove = useCallback(async (id) => {
    setSaving(true);
    try {
      await inboxApi.delete(`/channels/meta/accounts/${id}`);
      await load();
    } finally {
      setSaving(false);
    }
  }, [load]);

  const rows = useMemo(() => items.map((acc) => ({
    ...acc,
    messaging_ok: hasMessagingPerm(acc.channel || channel, acc.permissions_json),
  })), [items, channel]);

  return (
    <section data-testid={`settings-${channel}-section`} className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{CHANNEL_LABEL[channel] || 'Meta'}</h3>
        <button
          type="button"
          data-testid={`${channel}-connect-btn`}
          onClick={connect}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? 'Conectando…' : 'Conectar nova conta'}
        </button>
      </header>

      {loading ? (
        <div className="text-sm text-gray-500" data-testid={`${channel}-accounts-loading`}>
          Carregando contas…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-dashed p-3 text-sm text-gray-600" data-testid={`${channel}-accounts-empty`}>
          Nenhuma conta conectada.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-3 py-2">Nome/Usuário</th>
                <th scope="col" className="px-3 py-2">Webhooks ativos?</th>
                <th scope="col" className="px-3 py-2">Mensagens ativas?</th>
                <th scope="col" className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((acc) => (
                <tr key={acc.id} data-testid={`${channel}-acc-${acc.id}`} className="bg-white">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">
                      {acc.name || acc.username || acc.external_account_id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {acc.channel === 'instagram' ? '@' : ''}{acc.username || acc.external_account_id}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">{formatBoolean(acc.webhook_subscribed)}</td>
                  <td className="px-3 py-2 align-middle">{formatBoolean(acc.messaging_ok)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-outline"
                        data-testid={`${channel}-sub-${acc.id}`}
                        onClick={() => subscribe(acc.id)}
                        disabled={saving || acc.webhook_subscribed}
                      >
                        {acc.webhook_subscribed ? 'Assinado' : 'Assinar webhooks'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        data-testid={`${channel}-reauth-${acc.id}`}
                        onClick={connect}
                        disabled={saving}
                      >
                        Reautorizar
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        data-testid={`${channel}-del-${acc.id}`}
                        onClick={() => remove(acc.id)}
                        disabled={saving}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function FacebookSection() {
  return (
    <FeatureGate code="fb_messaging" fallback={null}>
      <MetaAccounts channel="facebook" />
    </FeatureGate>
  );
}
