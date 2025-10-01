import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  test('atualiza pill após conectar', async () => {
    api.connectProvider.mockResolvedValue({
      integration: {
        provider: 'meta_facebook',
        status: 'connected',
        subscribed: true,
        meta: { page_name: 'Minha Página' },
      },
    });

    const user = userEvent.setup();
    renderWithRouterProviders(<FacebookCard />);

    await screen.findByTestId('facebook-card');
    await user.click(screen.getByRole('button', { name: /conectar/i }));

    expect(await screen.findByText('Webhook ativo')).toBeInTheDocument();
    expect(api.connectProvider).toHaveBeenCalledWith('meta_facebook', expect.any(Object));
  });
});
