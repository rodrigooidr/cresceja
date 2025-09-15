import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';
import FeatureGate from '../../ui/feature/FeatureGate.jsx';
import { openOAuth } from '../../utils/oauthDriver.js';

export function MetaAccounts({ channel }) {
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const { data } = await inboxApi.get('/channels/meta/accounts', { params: { channel } });
      const list = Array.isArray(data?.items) ? data.items : [];
      const filtered = list
        .filter((acc) => !channel || acc.channel == null || acc.channel === channel)
        .map((acc) => (acc.channel ? acc : { ...acc, channel }));
      setItems(filtered);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, [channel]);

  const connect = async () => {
    await openOAuth({ provider: channel, url: `/oauth/${channel}` , onSuccess: async (res)=> {
      const accounts = res?.accounts || [];
      if (accounts.length) {
        await inboxApi.post('/channels/meta/accounts/connect', { channel, accounts });
        await load();
      }
    }});
  };

  const subscribe = async (id) => {
    await inboxApi.post(`/channels/meta/accounts/${id}/subscribe`, { channel });
    await load();
  };
  const remove = async (id) => {
    await inboxApi.delete(`/channels/meta/accounts/${id}`);
    await load();
  };

  return (
    <section data-testid={`settings-${channel}-section`} className="space-y-2">
      <header className="flex items-center justify-between">
        <h3>{channel === 'facebook' ? 'Facebook' : 'Instagram'}</h3>
        <button data-testid={`${channel}-connect-btn`} type="button" onClick={connect}>Conectar nova conta</button>
      </header>
      <ul className="space-y-1">
        {items.map((acc) => (
          <li key={acc.id} data-testid={`${channel}-acc-${acc.id}`} className="flex items-center gap-2">
            <span className="flex-1 truncate">{acc.name || acc.username || acc.external_account_id}</span>
            <button
              data-testid={`${channel}-sub-${acc.id}`}
              type="button"
              onClick={() => subscribe(acc.id)}
              disabled={acc.webhook_subscribed}
            >
              {acc.webhook_subscribed ? 'Assinado' : 'Assinar webhooks'}
            </button>
            <button data-testid={`${channel}-reauth-${acc.id}`} type="button" onClick={connect}>Reautorizar</button>
            <button data-testid={`${channel}-del-${acc.id}`} type="button" onClick={() => remove(acc.id)}>Remover</button>
          </li>
        ))}
      </ul>
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
