import React from 'react';
import { screen } from '@testing-library/react';
import WhatsAppOfficialCard from '@/components/settings/WhatsAppOfficialCard.jsx';
import { renderWithRouterProviders } from '../../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn(),
  connectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
}));

const api = jest.requireMock('@/api/integrationsApi.js');

describe('WhatsAppOfficialCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getProviderStatus.mockResolvedValue({
      integration: { provider: 'whatsapp_cloud', status: 'disconnected', subscribed: false, meta: {} },
    });
  });

  test('renderiza status desconectado', async () => {
    renderWithRouterProviders(<WhatsAppOfficialCard />);
    expect(await screen.findByTestId('whatsapp-cloud-card')).toBeInTheDocument();
    expect(screen.getByText('Webhook inativo')).toBeInTheDocument();
    expect(api.getProviderStatus).toHaveBeenCalledWith('whatsapp_cloud');
  });
});
