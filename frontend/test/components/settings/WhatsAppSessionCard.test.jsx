import React from 'react';
import { screen } from '@testing-library/react';
import WhatsAppBaileysCard from '@/components/settings/WhatsAppBaileysCard.jsx';
import { renderWithRouterProviders } from '../../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn(),
  connectProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
}));

const api = jest.requireMock('@/api/integrationsApi.js');

describe('WhatsAppBaileysCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getProviderStatus.mockResolvedValue({
      integration: { provider: 'whatsapp_session', status: 'disconnected', meta: {} },
    });
  });

  test('renderiza status desconectado', async () => {
    renderWithRouterProviders(<WhatsAppBaileysCard />);
    expect(await screen.findByTestId('whatsapp-session-card')).toBeInTheDocument();
    expect(screen.getByText('Desconectado')).toBeInTheDocument();
    expect(api.getProviderStatus).toHaveBeenCalledWith('whatsapp_session');
  });
});
