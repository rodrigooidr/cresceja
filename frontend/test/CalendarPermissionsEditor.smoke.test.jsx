import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import CalendarPermissionsEditor from '@/pages/settings/CalendarPermissionsEditor';

test('salva aliases/skills/slot/buffers para um profissional', async () => {
  const calendars = [
    {
      name: 'Rodrigo',
      calendars: ['cal1', 'cal2'],
      aliases: ['dr rodrigo'],
      skills: ['consulta'],
      slotMin: 30,
      buffers: { pre: 10, post: 10 },
    },
  ];

  const originalFetch = global.fetch;
  const originalAlert = global.alert;
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  const fetchMock = jest.fn(async (url, options) => {
    if (
      String(url).includes('/api/calendar/calendars/Rodrigo/permissions') &&
      options?.method === 'PUT'
    ) {
      const body = JSON.parse(options.body);
      expect(body.aliases).toEqual(expect.arrayContaining(['dr rodrigo', 'rod']));
      expect(body.skills).toEqual(expect.arrayContaining(['consulta', 'avaliacao']));
      expect(body.slotMin).toBe(45);
      expect(body.buffers.pre).toBe(15);
      expect(body.buffers.post).toBe(5);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  global.fetch = fetchMock;
  global.alert = jest.fn();

  try {
    await act(async () => {
      render(<CalendarPermissionsEditor calendars={calendars} onSaved={() => {}} />);
    });

    const aliasesInput = screen.getByPlaceholderText(/dr rodrigo, rod, ro/i);
    fireEvent.change(aliasesInput, { target: { value: 'dr rodrigo, rod' } });

    const skillsInput = screen.getByPlaceholderText(/consulta, avaliacao/i);
    fireEvent.change(skillsInput, { target: { value: 'consulta, avaliacao' } });

    const slotInput = screen.getByLabelText(/Slot padrão/i);
    fireEvent.change(slotInput, { target: { value: '45' } });

    const preInput = screen.getByLabelText(/Buffer pré/i);
    fireEvent.change(preInput, { target: { value: '15' } });

    const postInput = screen.getByLabelText(/Buffer pós/i);
    fireEvent.change(postInput, { target: { value: '5' } });

    fireEvent.click(screen.getByText(/Salvar/i));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  } finally {
    consoleError.mockRestore();
    global.fetch = originalFetch;
    if (typeof originalAlert === 'undefined') {
      delete global.alert;
    } else {
      global.alert = originalAlert;
    }
  }
});
