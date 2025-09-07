import React, { useEffect, useState } from 'react';
import inboxApi from 'api/inboxApi';
import OrgSwitcher from 'components/OrgSwitcher';
import WhatsAppOfficialCard from '../../components/settings/WhatsAppOfficialCard';
import WhatsAppBaileysCard from '../../components/settings/WhatsAppBaileysCard';
import InstagramCard from '../../components/settings/InstagramCard';
import FacebookCard from '../../components/settings/FacebookCard';

export default function ChannelsPage() {
  const [tab, setTab] = useState('whatsapp');
  const [summary, setSummary] = useState(null);

  async function load() {
    try {
      const { data } = await inboxApi.get('/channels/summary');
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allowedSession = summary?.whatsapp_session?.allowed !== false;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <OrgSwitcher onChange={load} />
        <div className="flex gap-2">
          <button onClick={() => setTab('whatsapp')}>WhatsApp</button>
          <button onClick={() => setTab('instagram')}>Instagram</button>
          <button onClick={() => setTab('facebook')}>Facebook</button>
        </div>
      </div>

      {tab === 'whatsapp' && (
        <div>
          <WhatsAppOfficialCard
            data={summary?.whatsapp_official || { status: 'disconnected' }}
            refresh={load}
          />
          <div className="mt-6">
            <WhatsAppBaileysCard
              data={summary?.whatsapp_session || { status: 'disconnected' }}
              disabled={!allowedSession}
              refresh={load}
            />
          </div>
        </div>
      )}

      {tab === 'instagram' && (
        <InstagramCard
          data={summary?.instagram || { status: 'disconnected' }}
          refresh={load}
        />
      )}

      {tab === 'facebook' && (
        <FacebookCard
          data={summary?.facebook || { status: 'disconnected' }}
          refresh={load}
        />
      )}
    </div>
  );
}

