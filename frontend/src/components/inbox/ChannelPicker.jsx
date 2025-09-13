import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';
import { useOrg } from '../../contexts/OrgContext';
import FeatureGate from '../../ui/feature/FeatureGate.jsx';
import useToastFallback from '../../hooks/useToastFallback.js';

function InnerChannelPicker({ onChange }) {
  const { selected: orgId } = useOrg();
  const toast = useToastFallback();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem('active_channel_id') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!orgId) return;
    let isMounted = true;
    setLoading(true);
    inboxApi
      .get(`/orgs/${orgId}/whatsapp/channels`, { meta: { scope: 'global' } })
      .then((r) => {
        if (!isMounted) return;
        const list = Array.isArray(r.data) ? r.data : [];
        setChannels(list);
        let active = value;
        if (!list.find((c) => String(c.id) === String(active))) {
          const firstActive = list.find((c) => c.is_active);
          active = firstActive?.id || list[0]?.id || '';
        }
        if (active) {
          setValue(String(active));
          try { localStorage.setItem('active_channel_id', String(active)); } catch {}
          onChange?.(String(active));
        }
      })
      .catch((err) => {
        toast({
          title: 'Falha ao carregar canais',
          description: err?.response?.data?.message || err.message,
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const handleChange = (e) => {
    const newId = e.target.value;
    setValue(newId);
    try { localStorage.setItem('active_channel_id', newId); } catch {}
    onChange?.(newId);
  };

  if (loading) {
    return <div className="h-8 bg-gray-200 rounded animate-pulse" data-testid="channel-picker-loading" />;
  }

  if (!channels.length) {
    return (
      <div className="text-sm" data-testid="channel-picker-empty">
        Nenhum número configurado. Configure em{' '}
        <a href="/settings" className="text-blue-600 underline">Configurações → WhatsApp</a>.
      </div>
    );
  }

  const current = channels.find((c) => String(c.id) === String(value));

  return (
    <div className="mb-2">
      <label className="block text-xs font-semibold mb-1" htmlFor="channel-picker-select">Número WhatsApp</label>
      <div className="flex items-center gap-2">
        <select
          id="channel-picker-select"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          value={value}
          onChange={handleChange}
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.display_name || ch.phone_e164}
            </option>
          ))}
        </select>
        {current?.provider && (
          <span className="text-xs px-1 py-0.5 border rounded">
            {current.provider}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChannelPicker(props) {
  return (
    <FeatureGate code="whatsapp_numbers" fallback={null}>
      <InnerChannelPicker {...props} />
    </FeatureGate>
  );
}
