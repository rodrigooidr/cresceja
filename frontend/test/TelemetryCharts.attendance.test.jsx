import React from 'react';
import { render, screen } from '@testing-library/react';
import TelemetryCharts from '@/pages/governanca/TelemetryCharts';

test('renderiza gráfico de comparecimento empilhado', () => {
  const attendance = [
    { day: '2025-09-20', pending: 1, confirmed: 2, canceled: 1, noshow: 0 },
    { day: '2025-09-21', pending: 0, confirmed: 3, canceled: 0, noshow: 1 },
  ];
  render(<TelemetryCharts attendance={attendance} />);
  expect(screen.getByLabelText(/chart-attendance/i)).toBeInTheDocument();
});
