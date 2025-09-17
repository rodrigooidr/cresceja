import React from 'react';
import { render, screen } from '@testing-library/react';
import TelemetryCharts from '@/pages/governanca/TelemetryCharts';

const data = {
  wa_send_daily: [
    { day: '2025-09-01', transport: 'cloud', provider_ok: 10, provider_fallback: 2, total_attempts: 12 },
    { day: '2025-09-02', transport: 'cloud', provider_ok: 7,  provider_fallback: 1, total_attempts: 8  },
  ],
  wa_latency_daily: [
    { day: '2025-09-01', transport: 'cloud', p50_ms: 180, p95_ms: 450, samples: 20 },
    { day: '2025-09-02', transport: 'cloud', p50_ms: 160, p95_ms: 420, samples: 18 },
  ],
  inbox_volume_daily: [
    { day: '2025-09-01', inbound_count: 5, outbound_count: 8, total: 13 },
    { day: '2025-09-02', inbound_count: 4, outbound_count: 6, total: 10 },
  ],
  inbox_ttfr_daily: [
    { day: '2025-09-01', ttfr_p50: 35, ttfr_p95: 120, samples: 8 },
    { day: '2025-09-02', ttfr_p50: 30, ttfr_p95: 100, samples: 6 },
  ],
};

test('renderiza charts sem crash e mostra títulos', () => {
  render(<TelemetryCharts data={data} />);
  expect(screen.getByText(/WhatsApp — Envios por dia/i)).toBeInTheDocument();
  expect(screen.getByText(/WhatsApp — Latência/i)).toBeInTheDocument();
  expect(screen.getByText(/Inbox — Volume por dia/i)).toBeInTheDocument();
  expect(screen.getByText(/Inbox — TTFR/i)).toBeInTheDocument();
});
