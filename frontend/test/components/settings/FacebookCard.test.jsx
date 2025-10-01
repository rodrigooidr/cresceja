import React from 'react';
import { screen } from '@testing-library/react';
import FacebookCard from '@/components/settings/FacebookCard.jsx';
import { renderWithRouterProviders } from '../../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn(),
  connectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
}));

const api = jest.requireMock('@/api/integrationsApi.js');

describe('FacebookCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getProviderStatus.mockResolvedValue({
      integration: { provider: 'meta_facebook', status: 'disconnected', subscribed: false, meta: {} },
    });
  });

  test('renderiza status desconectado', async () => {
    renderWithRouterProviders(<FacebookCard />);
    expect(await screen.findByTestId('facebook-card')).toBeInTheDocument();
    expect(screen.getByText('Webhook inativo')).toBeInTheDocument();
    expect(api.getProviderStatus).toHaveBeenCalledWith('meta_facebook');
  });
});
