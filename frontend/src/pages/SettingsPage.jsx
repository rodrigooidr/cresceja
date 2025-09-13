import React from 'react';
import FeatureGate from '../ui/feature/FeatureGate.jsx';
import useOrgFeatures from '../hooks/useOrgFeatures.js';

export default function SettingsPage() {
  const { features } = useOrgFeatures();

  return (
    <div className="p-6" data-testid="settings-page">
      <h1 className="text-2xl font-semibold mb-4">Configurações</h1>

      <FeatureGate code="google_calendar_accounts">
        <div className="mb-4 border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Google Calendar</h2>
          <p className="text-sm mb-2">
            {(features['google_calendar_accounts']?.used || 0)} de {features['google_calendar_accounts']?.limit ?? '∞'}
          </p>
        </div>
      </FeatureGate>
    </div>
  );
}

