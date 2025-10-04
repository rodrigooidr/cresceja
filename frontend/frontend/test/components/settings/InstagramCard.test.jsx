import React from 'react';
import { screen } from '@testing-library/react';
import InstagramCard from '@/components/settings/InstagramCard.jsx';
import { renderWithRouterProviders } from '../../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn(),
  connectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
}));

const api = jest.requireMock('@/api/integrationsApi.js');

describe('InstagramCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getProviderStatus.mockResolvedValue({
      integration: { provider: 'meta_instagram', status: 'disconnected', subscribed: false, meta: {} },
    });
  });

  test('renderiza status desconectado', async () => {
    renderWithRouterProviders(<InstagramCard />);
    expect(await screen.findByTestId('instagram-card')).toBeInTheDocument();
    expect(screen.getByText('Webhook inativo')).toBeInTheDocument();
    expect(api.getProviderStatus).toHaveBeenCalledWith('meta_instagram');
  });
});
