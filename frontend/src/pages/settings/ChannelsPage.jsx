// frontend/src/pages/settings/ChannelsPage.jsx
import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';
import WhatsAppOfficialCard from '../../components/settings/WhatsAppOfficialCard';
import WhatsAppBaileysCard from '../../components/settings/WhatsAppBaileysCard';
import InstagramCard from '../../components/settings/InstagramCard';
import FacebookCard from '../../components/settings/FacebookCard';

export default function ChannelsPage() {
  const [tab, setTab] = useState('whatsapp');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const safe = (r, fallback) =>
    r?.status === 'fulfilled' && r.value?.data ? r.value.data : fallback;

  async function load() {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        // WhatsApp Cloud (oficial)
        inboxApi.get('/integrations/whatsapp/cloud/status'),
        // WhatsApp Session (Baileys)
        inboxApi.get('/integrations/whatsapp/session/status'),
        // Facebook pages (Meta)
        inboxApi.get('/integrations/meta/pages'),
        // Instagram accounts (Meta)
        inboxApi.get('/integrations/meta/ig-accounts'),
      ]);

      const [waCloudRes, waSessRes, fbPagesRes, igAccRes] = results;

      const waCloud = safe(waCloudRes, { status: 'disconnected' });
      const waSess  = safe(waSessRes,  null); // mantém null para respeitar o render condicional
      const fbPages = safe(fbPagesRes,  { items: [] });
      const igAcc   = safe(igAccRes,    { items: [] });

      setSummary({
        whatsapp_official: waCloud,          // esperado pelo WhatsAppOfficialCard
        whatsapp_baileys: waSess,            // renderiza BaileysCard só se houver dados
        facebook: { status: 'disconnected', pages: fbPages.items || [] },
        instagram: { status: 'disconnected', accounts: igAcc.items || [] },
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (!alive) return;
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !summary) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('whatsapp')}>WhatsApp</button>
        <button onClick={() => setTab('instagram')}>Instagram</button>
        <button onClick={() => setTab('facebook')}>Facebook</button>
      </div>

      <div className="mb-4 text-right">
        <button
          className="px-3 py-1 bg-blue-600 text-white"
          onClick={load}
        >
          Verificar Conectividade
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
