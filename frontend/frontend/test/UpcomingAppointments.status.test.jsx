import React from 'react';
import { render, screen } from '@testing-library/react';
import UpcomingAppointments from '@/pages/inbox/components/UpcomingAppointments';

function mkResp(json) {
  return { ok: true, json: async () => json, text: async () => JSON.stringify(json) };
}

describe('UpcomingAppointments RSVP status', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url, opts) => {
      if (String(url).includes('/api/calendar/events') && (!opts || opts.method === 'GET')) {
        return mkResp({
          items: [
            {
              id: '1',
              summary: 'Consulta',
              start_at: '2025-09-23T17:00:00.000Z',
              end_at: '2025-09-23T18:00:00.000Z',
              rsvp_status: 'confirmed',
            },
          ],
        });
      }
      return mkResp({ ok: true });
    });
    window.alert = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
    delete window.alert;
  });

  test('exibe badge de status do RSVP', async () => {
    render(<UpcomingAppointments contactId="c1" onReschedule={() => {}} />);
    await screen.findByText(/Consulta/i);
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });
});
