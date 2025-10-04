import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TelemetryPage from '@/pages/governanca/TelemetryPage.jsx';
import inboxApi from '@/api/inboxApi';
jest.mock('@/api/inboxApi');

const mkResp = (json) => ({ ok: true, json: async () => json });

afterEach(() => {
  delete global.fetch;
});

test('carrega e filtra auditoria', async () => {
  global.fetch = jest.fn(async (url) => {
    const target = String(url);
    if (target.includes('/telemetry/overview')) return mkResp({});
    if (target.includes('/telemetry/appointments/overview')) return mkResp({ items: [] });
    if (target.includes('/telemetry/appointments/funnel')) return mkResp({ items: [] });
    if (target.includes('/telemetry/appointments/by-person-service')) return mkResp({ items: [] });
    return mkResp({});
  });

  inboxApi.get.mockResolvedValueOnce({ data: { items: [{ created_at: new Date().toISOString(), user_id: 'u1', action: 'calendar.remind.sent', entity: 'calendar_event', entity_id: 'e1', payload: { ok:true } }] } });
  render(<TelemetryPage />);
  await screen.findByText(/Auditoria recente/i);
  fireEvent.change(screen.getByPlaceholderText(/Filtrar por action/i), { target: { value: 'calendar.remind.sent' }});
  inboxApi.get.mockResolvedValueOnce({ data: { items: [] } });
  fireEvent.click(screen.getByText(/Atualizar/i));
  await waitFor(() => screen.getByText(/Sem registros/i));
});
