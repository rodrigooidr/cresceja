import React, { useCallback, useState } from 'react';
import inboxApi from 'api/inboxApi';
import WhatsAppOfficialCard from 'components/settings/WhatsAppOfficialCard';
import WhatsAppBaileysCard from 'components/settings/WhatsAppBaileysCard';
import InstagramCard from 'components/settings/InstagramCard';
import FacebookCard from 'components/settings/FacebookCard';
import OrgSelector from 'components/settings/OrgSelector';
import useOrgRefetch from '../../hooks/useOrgRefetch';

export default function ChannelsPage() {
  const [tab, setTab] = useState('whatsapp');
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    const { data } = await inboxApi.get('/channels/summary');
    setSummary(data);
  }, []);

  useOrgRefetch(load, [load]);

  if (!summary) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <OrgSelector />

      <div className="flex gap-4 mb-4 border-b">
        <button
          className={`pb-2 ${tab === 'whatsapp' ? 'border-b-2 border-blue-600 font-medium' : 'text-gray-500'}`}
          onClick={() => setTab('whatsapp')}
        >
          WhatsApp
        </button>
        <button
          className={`pb-2 ${tab === 'instagram' ? 'border-b-2 border-blue-600 font-medium' : 'text-gray-500'}`}
          onClick={() => setTab('instagram')}
        >
          Instagram
        </button>
        <button
          className={`pb-2 ${tab === 'facebook' ? 'border-b-2 border-blue-600 font-medium' : 'text-gray-500'}`}
          onClick={() => setTab('facebook')}
        >
          Facebook
        </button>
      </div>

      {tab === 'whatsapp' && (
        <div>
          <WhatsAppOfficialCard data={summary.whatsapp_official} refresh={load} />
          {summary.whatsapp_baileys && (
            <WhatsAppBaileysCard data={summary.whatsapp_baileys} refresh={load} />
          )}
        </div>
      )}

      {tab === 'instagram' && (
        <InstagramCard data={summary.instagram} refresh={load} />
      )}

      {tab === 'facebook' && (
        <FacebookCard data={summary.facebook} refresh={load} />
      )}
    </div>
  );
}

