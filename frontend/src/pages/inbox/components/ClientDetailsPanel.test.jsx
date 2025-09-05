import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import inboxApi from '@/api/inboxApi';
import ClientDetailsPanel from './ClientDetailsPanel.jsx';

jest.mock('@/api/inboxApi');

test('sends only changed fields and parses dd/mm/yyyy', async () => {
  inboxApi.get.mockResolvedValue({
    data: { id: 1, name: 'Foo', birthdate: '2000-01-01', notes: 'old', tags: ['vip'] },
  });
  let sent = null;
  inboxApi.put.mockImplementation((_url, body) => {
    sent = body;
    return Promise.resolve({ data: { ok: true, client: { id: 1, ...body } } });
  });

  const addToast = jest.fn();
  render(
    <ClientDetailsPanel
      conversation={{ id: 1, client_name: 'Foo' }}
      onApplyTags={jest.fn()}
      addToast={addToast}
    />
  );

  const dateInput = await screen.findByDisplayValue('2000-01-01');
  dateInput.setAttribute('type', 'text');
  fireEvent.change(dateInput, { target: { value: '05/06/2000' } });
  await waitFor(() => expect(screen.getByDisplayValue('05/06/2000')).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText(/Observações gerais/i), {
    target: { value: 'new notes' },
  });

  fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

  await waitFor(() => {
    expect(addToast).toHaveBeenCalledWith({
      kind: 'success',
      text: 'Dados do cliente salvos',
    });
  });

  expect(sent).toEqual({ birthdate: '2000-06-05', notes: 'new notes' });
});
