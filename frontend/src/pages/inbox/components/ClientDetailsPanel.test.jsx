// frontend/src/pages/inbox/components/ClientDetailsPanel.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ClientDetailsPanel from './ClientDetailsPanel.jsx';

// Mock explícito do axios wrapper (deve vir antes do import real)
jest.mock('api/inboxApi', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

const inboxApi = require('api/inboxApi').default;

test('sends only changed fields and parses dd/mm/yyyy', async () => {
  inboxApi.get.mockResolvedValue({
    data: { id: 1, name: 'Foo', birthdate: '2000-01-01', notes: 'old', tags: ['vip'] },
  });

  let sentBody = null;
  inboxApi.put.mockImplementation((_url, body) => {
    sentBody = body;
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

  const birthdateInput = await screen.findByLabelText(/Data de nascimento/i);
  const notesTextarea = await screen.findByLabelText(/Outras informações/i);

  fireEvent.change(birthdateInput, { target: { value: '05/06/2000' } });
  fireEvent.change(notesTextarea, { target: { value: 'new notes' } });

  fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

  await waitFor(() =>
    expect(addToast).toHaveBeenCalledWith({ kind: 'success', text: 'Dados do cliente salvos' })
  );

  expect(sentBody).toEqual({ birthdate: '2000-06-05', notes: 'new notes' });
  expect(inboxApi.put).toHaveBeenCalledWith('/inbox/conversations/1/client', sentBody);
});
