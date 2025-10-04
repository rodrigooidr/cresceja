import React from 'react';
import { screen } from '@testing-library/react';
import GoogleCalendarCard from '@/components/settings/GoogleCalendarCard.jsx';
import { renderWithRouterProviders } from '../../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn(),
  connectProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
}));

const api = jest.requireMock('@/api/integrationsApi.js');

describe('GoogleCalendarCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getProviderStatus.mockResolvedValue({
      integration: { provider: 'google_calendar', status: 'disconnected', subscribed: false, meta: {} },
    });
  });

  test('renderiza com status desconectado', async () => {
    renderWithRouterProviders(<GoogleCalendarCard />);
    expect(await screen.findByTestId('google-calendar-card')).toBeInTheDocument();
    expect(screen.getByText('Desconectado')).toBeInTheDocument();
    expect(api.getProviderStatus).toHaveBeenCalledWith('google_calendar');
  });
});
