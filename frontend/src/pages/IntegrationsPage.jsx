import React from 'react';
import WhatsAppOfficialCard from '@/components/settings/WhatsAppOfficialCard.jsx';
import WhatsAppBaileysCard from '@/components/settings/WhatsAppBaileysCard.jsx';
import InstagramCard from '@/components/settings/InstagramCard.jsx';
import FacebookCard from '@/components/settings/FacebookCard.jsx';
import GoogleCalendarCard from '@/components/settings/GoogleCalendarCard.jsx';

export default function IntegrationsPage() {
  return (
    <div className="space-y-6 p-6" data-testid="integrations-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-gray-600">
          Conecte canais oficiais e calendários para automatizar a sua operação.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <WhatsAppOfficialCard />
        <WhatsAppBaileysCard />
        <InstagramCard />
        <FacebookCard />
        <GoogleCalendarCard />
      </div>
    </div>
  );
}

