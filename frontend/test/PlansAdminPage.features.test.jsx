import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlansAdminPage from '../src/pages/admin/PlansAdminPage.jsx';

jest.mock('../src/contexts/AuthContext.jsx', () => ({
  __esModule: true,
  useAuth: () => ({ user: { role: 'SuperAdmin' }, isAuthenticated: true }),
}));
jest.mock('../src/contexts/OrgContext.jsx', () => ({
  __esModule: true,
  useOrg: () => ({ selected: null, setSelected: () => {} }),
  OrgProvider: ({ children }) => <>{children}</>,
}));

jest.mock('../src/api/inboxApi.js', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() }
}));
const inboxApi = require('../src/api/inboxApi.js').default;

function setupMocks() {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: 'plan1', name: 'Plano 1' }] });
  inboxApi.get.mockResolvedValueOnce({
    data: [
      { code: 'whatsapp_numbers', label: 'Números WhatsApp', type: 'number', category: 'whatsapp', value: { enabled: true, limit: 1 } },
      { code: 'whatsapp_mode_baileys', label: 'Baileys', type: 'boolean', category: 'whatsapp', value: { enabled: false, limit: 1 } },
    ],
  });
}

test('editar e salvar features', async () => {
  setupMocks();
  const user = userEvent.setup();
  render(<PlansAdminPage />);
  await user.selectOptions(await screen.findByRole('combobox'), 'plan1');
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
    },
  });
});

test('validação de limite', async () => {
  setupMocks();
  const user = userEvent.setup();
  render(<PlansAdminPage />);
  await user.selectOptions(await screen.findByRole('combobox'), 'plan1');
  const numInput = await screen.findByRole('spinbutton', { name: 'whatsapp_numbers' });
  await user.clear(numInput);
  await user.type(numInput, '-1');
  expect(await screen.findByText(/inteiro ≥ 0/i)).toBeInTheDocument();
  const saveBtn = screen.getByRole('button', { name: /salvar/i });
  expect(saveBtn).toBeDisabled();
  await user.clear(numInput);
  expect(screen.queryByText(/inteiro ≥ 0/i)).not.toBeInTheDocument();
});
