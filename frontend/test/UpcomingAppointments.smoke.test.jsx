import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import UpcomingAppointments from '@/pages/inbox/components/UpcomingAppointments';

function mkResp(json, ok = true, status = 200) {
  return { ok, status, json: async () => json, text: async () => JSON.stringify(json) };
}

test('lista e cancela um agendamento', async () => {
  const contactId = '11111111-1111-1111-1111-111111111111';
  const items = [{
    id: 'loc-1',
    summary: 'Consulta',
    start_at: '2025-09-23T17:00:00.000Z',
    end_at: '2025-09-23T18:00:00.000Z',
    external_event_id: 'evt-1',
    calendar_id: 'cal1'
  }];

  const fetchMock = jest.fn(async (url, opts) => {
    if (String(url).includes('/api/calendar/events') && (!opts || opts.method === 'GET')) {
      return mkResp({ items });
    }
    if (String(url).includes('/api/calendar/events/evt-1') && opts?.method === 'DELETE') {
      return mkResp({ ok: true });
    }
    throw new Error('unexpected ' + url);
  });
  const originalFetch = global.fetch;
  global.fetch = fetchMock;

  const oldConfirm = window.confirm;
  window.confirm = () => true;

  render(<UpcomingAppointments contactId={contactId} onReschedule={() => {}} />);

  await screen.findByText(/Consulta/i);
  // clica cancelar
  await act(async () => {
    fireEvent.click(screen.getByText(/Cancelar/i));
  });

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/calendar/events/evt-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  window.confirm = oldConfirm;
  global.fetch = originalFetch;
});
