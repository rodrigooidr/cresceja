import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';
import WhatsAppOfficialCard from '../../components/settings/WhatsAppOfficialCard';
import WhatsAppBaileysCard from '../../components/settings/WhatsAppBaileysCard';
import InstagramCard from '../../components/settings/InstagramCard';
import FacebookCard from '../../components/settings/FacebookCard';

export default function ChannelsPage() {
  const [tab, setTab] = useState('whatsapp');
  const [summary, setSummary] = useState(null);

  async function load() {
    const { data } = await inboxApi.get('/channels/summary');
    setSummary(data);
  }

  useEffect(() => {
    load();
  }, []);

  if (!summary) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('whatsapp')}>WhatsApp</button>
        <button onClick={() => setTab('instagram')}>Instagram</button>
        <button onClick={() => setTab('facebook')}>Facebook</button>
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
