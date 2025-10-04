import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlansAdminPage from '../src/pages/admin/PlansAdminPage.jsx';
import inboxApi from '../src/api/inboxApi';
import { renderApp } from './utils/renderApp.jsx';
import { actTick } from './utils/actUtils';

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));

function setupMocks() {
  inboxApi.__mockRoute('GET', '/admin/plans', () => ({ data: [{ id: 'plan1', name: 'Plano 1' }] }));
  inboxApi.__mockRoute('GET', /\/admin\/plans\/plan1\/features/, () => ({
    data: [
      { code: 'whatsapp_numbers', label: 'Números WhatsApp', type: 'number', value: { enabled: true, limit: 1 } },
      { code: 'whatsapp_mode_baileys', label: 'Baileys', type: 'boolean', value: { enabled: false, limit: 1 } },
      { code: 'post_tipo', label: 'Tipo de Post', type: 'enum', options: ['Imagem', 'Vídeo'], value: 'Imagem' },
    ],
  }));
  inboxApi.__mockRoute('PUT', /\/admin\/plans\/plan1\/features/, () => ({ data: { ok: true } }));
}

test('editar e salvar features', async () => {
  setupMocks();
  jest.useRealTimers();
  const user = userEvent.setup();
  renderApp(<PlansAdminPage />, { route: '/admin/plans' });
  await actTick();
  await screen.findByTestId('plans-admin-form');
  const numInput = screen.getByTestId('feature-limit-whatsapp_numbers');
  const boolSwitch = screen.getByTestId('feature-toggle-whatsapp_mode_baileys');
  await user.click(boolSwitch);
  fireEvent.change(numInput, { target: { value: '3' } });
  const saveBtn = screen.getByTestId('plans-admin-save');
  await user.click(saveBtn);
  expect(inboxApi.put).toHaveBeenCalledWith(
    '/admin/plans/plan1/features',
    expect.arrayContaining([
      expect.objectContaining({
        code: 'whatsapp_numbers',
        value: expect.objectContaining({ enabled: true, limit: 3 }),
      }),
      expect.objectContaining({
        code: 'whatsapp_mode_baileys',
        value: expect.objectContaining({ enabled: true, limit: 1 }),
      }),
      expect.objectContaining({ code: 'post_tipo', value: 'Imagem' }),
    ]),
    expect.any(Object),
  );
  jest.useFakeTimers({ legacyFakeTimers: false });
});

test('validação de limite', async () => {
  setupMocks();
  jest.useRealTimers();
  const user = userEvent.setup();
  renderApp(<PlansAdminPage />, { route: '/admin/plans' });
  await actTick();
  await screen.findByTestId('plans-admin-form');
  const numInput = screen.getByTestId('feature-limit-whatsapp_numbers');
  fireEvent.change(numInput, { target: { value: '-1' } });
  expect(await screen.findByText(/inteiro ≥ 0/i)).toBeInTheDocument();
  const saveBtn = screen.getByTestId('plans-admin-save');
  expect(saveBtn).toBeDisabled();
  fireEvent.change(numInput, { target: { value: '' } });
  expect(screen.queryByText(/inteiro ≥ 0/i)).not.toBeInTheDocument();
  jest.useFakeTimers({ legacyFakeTimers: false });
});
