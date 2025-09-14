import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlansAdminPage from '../src/pages/admin/PlansAdminPage.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders.jsx';
import inboxApi from '../src/api/inboxApi';

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));

function setupMocks() {
  inboxApi.__mockRoute('GET', '/admin/plans', () => ({ data: [{ id: 'plan1', name: 'Plano 1' }] }));
  inboxApi.__mockRoute('GET', /\/admin\/plans\/plan1\/features/, () => ({
    data: [
      { code: 'whatsapp_numbers', label: 'Números WhatsApp', type: 'number', category: 'whatsapp', value: { enabled: true, limit: 1 } },
      { code: 'whatsapp_mode_baileys', label: 'Baileys', type: 'boolean', category: 'whatsapp', value: { enabled: false, limit: 1 } },
      { code: 'post_tipo', label: 'Tipo de Post', type: 'enum', category: 'marketing', options: ['Imagem', 'Vídeo'], value: 'Imagem' },
    ],
  }));
  inboxApi.__mockRoute('PUT', /\/admin\/plans\/plan1\/features/, () => ({ data: { ok: true } }));
}

test('editar e salvar features', async () => {
  setupMocks();
  jest.useRealTimers();
  const user = userEvent.setup();
  renderWithRouterProviders(<PlansAdminPage />);
  await screen.findByText('Plano 1');
  await user.selectOptions(screen.getByRole('combobox'), 'plan1');
  const boolSwitch = await screen.findByRole('checkbox', { name: 'whatsapp_mode_baileys' });
  await user.click(boolSwitch);
  const numInput = screen.getByRole('spinbutton', { name: 'whatsapp_numbers' });
  await user.clear(numInput);
  await user.type(numInput, '3');
  const saveBtn = screen.getByRole('button', { name: /salvar/i });
  await user.click(saveBtn);
  expect(inboxApi.put).toHaveBeenCalledWith('/admin/plans/plan1/features', {
    features: {
      whatsapp_numbers: { enabled: true, limit: 3 },
      whatsapp_mode_baileys: { enabled: true, limit: 1 },
      post_tipo: { enabled: false, limit: 1 },
    },
  });
  jest.useFakeTimers();
});

test('validação de limite', async () => {
  setupMocks();
  jest.useRealTimers();
  const user = userEvent.setup();
  renderWithRouterProviders(<PlansAdminPage />);
  await screen.findByText('Plano 1');
  await user.selectOptions(screen.getByRole('combobox'), 'plan1');
  const numInput = await screen.findByRole('spinbutton', { name: 'whatsapp_numbers' });
  await user.clear(numInput);
  await user.type(numInput, '-1');
  expect(await screen.findByText(/inteiro ≥ 0/i)).toBeInTheDocument();
  const saveBtn = screen.getByRole('button', { name: /salvar/i });
  expect(saveBtn).toBeDisabled();
  await user.clear(numInput);
  expect(screen.queryByText(/inteiro ≥ 0/i)).not.toBeInTheDocument();
  jest.useFakeTimers();
});
