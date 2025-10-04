import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationEvents from '@/pages/integrations/IntegrationEvents.jsx';
import { listEvents } from '@/api/integrationsApi.js';

jest.mock('@/api/integrationsApi.js', () => ({
  listEvents: jest.fn(),
}));

describe('IntegrationEvents', () => {
  beforeEach(() => {
    listEvents.mockReset();
  });

  test('renders empty state when there are no events', async () => {
    listEvents.mockResolvedValue({ items: [], total: 0 });
    render(<IntegrationEvents />);

    expect(await screen.findByTestId('integration-events-empty')).toBeInTheDocument();
    expect(listEvents).toHaveBeenCalledWith({ provider: undefined, limit: 20, offset: 0, start: expect.any(String), end: expect.any(String) });
  });

  test('displays events and paginates correctly', async () => {
    listEvents
      .mockResolvedValueOnce({
        items: [
          {
            id: 'evt-1',
            provider: 'meta_facebook',
            received_at: '2024-01-01T12:00:00Z',
            event_type: 'messages',
            summary: 'Mensagem recebida',
            payload: { foo: 'bar' },
          },
        ],
        total: 25,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'evt-2',
            provider: 'meta_facebook',
            received_at: '2024-01-01T11:00:00Z',
            event_type: 'messages',
            summary: 'Outro evento',
            payload: {},
          },
        ],
        total: 25,
      });

    render(<IntegrationEvents />);

    expect(await screen.findByText('Mensagem recebida')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Próximo/i }));

    await waitFor(() => {
      expect(listEvents).toHaveBeenCalledTimes(2);
      expect(listEvents).toHaveBeenLastCalledWith({
        provider: undefined,
        limit: 20,
        offset: 20,
        start: expect.any(String),
        end: expect.any(String),
      });
    });
  });

  test('changes provider filter and refetches', async () => {
    listEvents.mockResolvedValue({ items: [], total: 0 });
    render(<IntegrationEvents />);

    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(screen.getByLabelText(/Provedor/i), 'meta_instagram');

    await waitFor(() => {
      expect(listEvents).toHaveBeenCalledTimes(2);
      expect(listEvents).toHaveBeenLastCalledWith({
        provider: 'meta_instagram',
        limit: 20,
        offset: 0,
        start: expect.any(String),
        end: expect.any(String),
      });
    });
  });
});
