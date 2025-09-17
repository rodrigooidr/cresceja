import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScheduleModal from '@/pages/inbox/components/ScheduleModal';

function mkResp(json, ok = true, status = 200) {
  return { ok, status, json: async () => json, text: async () => JSON.stringify(json) };
}

describe('ScheduleModal - direto e conflito', () => {
  const contact = { id: 'cont-1', display_name: 'Cliente Teste', email: 'cliente@example.com' };

  beforeEach(() => {
    global.fetch = jest.fn(async (url, opts) => {
      if (typeof url === 'string' && url.includes('/api/calendar/calendars')) {
        return mkResp({ items: [{ name: 'Rodrigo', calendars: ['cal1'], aliases: [] }] });
      }
      if (typeof url === 'string' && url.includes('/api/calendar/services')) {
        return mkResp({ items: [{ name: 'Mentoria', durationMin: 45, defaultSkill: 'mentoria' }] });
      }
      if (typeof url === 'string' && url.includes('/api/calendar/events')) {
        const body = JSON.parse(opts?.body || '{}');
        // sem sugestão: usa data/hora digitados para compor start/end
        expect(body.startISO).toMatch(/^2025-09-23T/);
        // se quisermos simular conflito:
        if (body.summary === 'Mentoria') {
          return mkResp({ error: 'time_conflict' }, false, 409);
        }
        return mkResp({ id: 'evt-2', summary: body.summary, start: body.startISO, end: body.endISO });
      }
      throw new Error('unexpected fetch ' + url);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('agenda direto usando data/hora e duração do serviço', async () => {
    const onScheduled = jest.fn();

    render(
      <ScheduleModal
        open
        onClose={() => {}}
        contact={contact}
        defaultPersonName="Rodrigo"
        defaultServiceName="Mentoria" // 45 min
        onScheduled={onScheduled}
      />
    );

    const serviceSelect = await screen.findByLabelText(/Serviço/i);
    await screen.findByRole('option', { name: /Mentoria/ });
    fireEvent.change(serviceSelect, { target: { value: 'Mentoria' } });
    await waitFor(() => expect(serviceSelect.value).toBe('Mentoria'));

    // define data/hora
    fireEvent.change(screen.getByLabelText(/Data/i), { target: { value: '2025-09-23' } });
    fireEvent.change(screen.getByLabelText(/Hora/i), { target: { value: '10:00' } });

    // clicar Agendar (vai retornar 409 no nosso mock por summary=Mentoria)
    const bookBtn = screen.getByRole('button', { name: /Agendar/i });
    fireEvent.click(bookBtn);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/calendar/events'),
        expect.any(Object)
      )
    );

    const [, opts] = global.fetch.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('/api/calendar/events')
    );
    const body = JSON.parse(opts.body || '{}');
    expect(body.summary).toBe('Mentoria');

    // deve mostrar mensagem de conflito
    await screen.findByText(/Horário indisponível \(conflito\)/i);
  });
});
