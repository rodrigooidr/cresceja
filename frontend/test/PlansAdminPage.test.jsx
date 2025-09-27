import React from 'react';
import { screen } from '@testing-library/react';
import { renderApp } from './utils/renderApp.jsx';
import inboxApi from '../src/api/inboxApi';
import PlansAdminPage from '../src/pages/admin/PlansAdminPage.jsx';
import { actTick } from './utils/actUtils';

test('renderiza e carrega primeiro plano', async () => {
  inboxApi.__mockRoute('GET', '/admin/plans', () => ({ data: [{ id: 'plan1', name: 'Plano 1' }] }));
  inboxApi.__mockRoute('GET', /\/admin\/plans\/plan1\/features/, () => ({
    data: [
      { code: 'whatsapp_numbers', label: 'Números WhatsApp', type: 'number', value: { enabled: true, limit: 1 } },
      { code: 'whatsapp_mode_baileys', label: 'Baileys', type: 'boolean', value: { enabled: false } },
    ],
  }));

  renderApp(<PlansAdminPage />, { route: '/admin/plans' });
  const title = await screen.findByTestId('plans-admin-title');
  expect(title).toBeInTheDocument();
  await actTick();
  expect(await screen.findByTestId('plans-admin-form')).toBeInTheDocument();
});
