import React from 'react';
import { render, screen } from '@testing-library/react';
import TelemetryPage from '@/pages/governanca/TelemetryPage';

afterEach(() => {
  delete global.fetch;
});

test('renderiza tabelas do funil e por profissional/serviço', async () => {
  global.fetch = jest.fn(async (url) => {
    const target = String(url);
    if (target.includes('/telemetry/overview')) {
      return { ok: true, json: async () => ({}) };
    }
    if (target.includes('/telemetry/appointments/overview')) {
      return { ok: true, json: async () => ({ items: [] }) };
    }
    if (target.includes('/telemetry/appointments/funnel')) {
      return {
        ok: true,
        json: async () => ({ items: [{ day: '2025-09-20', requested: 4, confirmed: 2, canceled: 1, noshow: 1 }] }),
      };
    }
    if (target.includes('/telemetry/appointments/by-person-service')) {
      return {
        ok: true,
        json: async () => ({
          items: [{ person: 'Rodrigo', service: 'Consulta', confirmed: 3, canceled: 0, noshow: 1 }],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });

  render(<TelemetryPage />);

  expect(await screen.findByText(/Funil de Agendamentos \(dia\)/i)).toBeInTheDocument();
  expect(await screen.findByText(/Por Profissional \/ Serviço/i)).toBeInTheDocument();
});
