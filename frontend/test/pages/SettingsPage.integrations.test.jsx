import React from 'react';
import { screen } from '@testing-library/react';
import IntegrationsPage from '@/pages/IntegrationsPage.jsx';
import { renderWithRouterProviders } from '../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn().mockImplementation((provider) =>
    Promise.resolve({ integration: { provider, status: 'disconnected', subscribed: false, meta: {} } })
  ),
  getAllStatus: jest.fn(),
  connectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
}));

describe('IntegrationsPage', () => {
  test('renderiza todos os cards principais', async () => {
    renderWithRouterProviders(<IntegrationsPage />);

    expect(await screen.findByTestId('whatsapp-cloud-card')).toBeInTheDocument();
    expect(await screen.findByTestId('whatsapp-session-card')).toBeInTheDocument();
    expect(await screen.findByTestId('instagram-card')).toBeInTheDocument();
    expect(await screen.findByTestId('facebook-card')).toBeInTheDocument();
    expect(await screen.findByTestId('google-calendar-card')).toBeInTheDocument();
  });
});
