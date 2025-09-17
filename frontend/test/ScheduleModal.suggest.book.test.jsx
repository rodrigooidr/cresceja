import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScheduleModal from '@/pages/inbox/components/ScheduleModal';

function mkResp(json, ok = true, status = 200) {
  return { ok, status, json: async () => json, text: async () => JSON.stringify(json) };
}

describe('ScheduleModal - sugestão e agendamento', () => {
  const contact = {
    id: 'cont-1',
    display_name: 'Cliente Teste',
    email: 'cliente@example.com',
    phone_e164: '+5511999999999',
  };

  beforeEach(() => {
    // Mock fetch sequencial por URL
    global.fetch = jest.fn(async (url, opts) => {
      if (typeof url === 'string' && url.includes('/api/calendar/calendars')) {
        return mkResp({ items: [{ name: 'Rodrigo', calendars: ['cal1'], aliases: ['dr rodrigo','rod'] }] });
      }
      if (typeof url === 'string' && url.includes('/api/calendar/services')) {
        return mkResp({ items: [{ name: 'Consulta', durationMin: 60, defaultSkill: 'consulta' }] });
      }
      if (typeof url === 'string' && url.includes('/api/calendar/suggest')) {
        return mkResp({ items: { Rodrigo: [{ start: '2025-09-23T17:00:00.000Z', end: '2025-09-23T18:00:00.000Z' }] } });
      }
      if (typeof url === 'string' && url.includes('/api/calendar/events')) {
        // valida headers/body mínimos
        expect(opts?.method).toBe('POST');
        expect(opts?.headers?.['Idempotency-Key']).toBeTruthy();
        const body = JSON.parse(opts?.body || '{}');
        expect(body.personName).toBe('Rodrigo'); // alias resolvido/aceito
        expect(body.contactId).toBe(contact.id);
        expect(body.startISO).toBe('2025-09-23T17:00:00.000Z');
        expect(body.endISO).toBe('2025-09-23T18:00:00.000Z');
        return mkResp({ id: 'evt-1', summary: 'Consulta', start: body.startISO, end: body.endISO, htmlLink: 'https://google.com' });
      }
      throw new Error('unexpected fetch ' + url);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('carrega catálogos, sugere horários e agenda com Idempotency-Key', async () => {
    const onScheduled = jest.fn();

    render(
      <ScheduleModal
        open
        onClose={() => {}}
        contact={contact}
        defaultPersonName="Rodrigo"
        defaultServiceName="Consulta"
        onScheduled={onScheduled}
      />
    );

    // aguarda os catálogos carregarem (campo Serviço renderizado)
    await screen.findByLabelText(/Serviço/i);

    // define data/hora (não importa para sugestão; usaremos o slot sugerido)
    fireEvent.change(screen.getByLabelText(/Data/i), { target: { value: '2025-09-23' } });
    fireEvent.change(screen.getByLabelText(/Hora/i), { target: { value: '14:00' } });

    // clicar "Sugerir horários"
    const suggestBtn = screen.getByRole('button', { name: /Sugerir horários/i });
    fireEvent.click(suggestBtn);

    // aguarda aparecer ao menos um chip de sugestão (botão)
    await waitFor(() => {
      const chips = document.querySelectorAll('button');
      expect(Array.from(chips).some(b => /–/.test(b.textContent || ''))).toBe(true); // exibe "HH:MM–HH:MM"
    });

    // clica no primeiro chip de sugestão
    const chip = Array.from(document.querySelectorAll('button')).find(b => /–/.test(b.textContent || ''));
    expect(chip).toBeTruthy();
    fireEvent.click(chip);

    // clica Agendar
    const bookBtn = screen.getByRole('button', { name: /Agendar/i });
    fireEvent.click(bookBtn);

    await waitFor(() => expect(onScheduled).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/calendar/events'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      })
    );
  });
});
