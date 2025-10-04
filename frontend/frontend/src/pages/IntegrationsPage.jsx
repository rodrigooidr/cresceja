import React, { useState } from 'react';
import WhatsAppOfficialCard from '@/components/settings/WhatsAppOfficialCard.jsx';
import WhatsAppBaileysCard from '@/components/settings/WhatsAppBaileysCard.jsx';
import InstagramCard from '@/components/settings/InstagramCard.jsx';
import FacebookCard from '@/components/settings/FacebookCard.jsx';
import GoogleCalendarCard from '@/components/settings/GoogleCalendarCard.jsx';
import IntegrationEvents from '@/pages/integrations/IntegrationEvents.jsx';

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('providers');

  const handleSelectTab = (tab) => () => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6 p-6" data-testid="integrations-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-gray-600">
          Conecte canais oficiais e calendários para automatizar a sua operação.
        </p>
      </header>
      <div role="tablist" aria-label="Configurações de integrações" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'providers'}
          id="integrations-tab-providers"
          onClick={handleSelectTab('providers')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'providers'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Provedores
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          id="integrations-tab-events"
          onClick={handleSelectTab('events')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'events'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Eventos
        </button>
      </div>

      {activeTab === 'providers' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="tabpanel" aria-labelledby="integrations-tab-providers">
          <WhatsAppOfficialCard />
          <WhatsAppBaileysCard />
          <InstagramCard />
          <FacebookCard />
          <GoogleCalendarCard />
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="integrations-tab-events">
          <IntegrationEvents />
        </div>
      )}
    </div>
  );
}

