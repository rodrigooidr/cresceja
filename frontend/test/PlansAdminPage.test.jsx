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
      { code: 'whatsapp_numbers', label: 'N\u00fameros WhatsApp', type: 'number', value: { enabled: true, limit: 1 } },
      { code: 'post_tipo', label: 'Tipo de Post', type: 'enum', options: ['Imagem','V\u00eddeo'], value: 'Imagem' },
    ],
  }));

  renderApp(<PlansAdminPage />, { route: '/admin/plans' });
  const title = await screen.findByRole('heading', { name: /Configura\u00e7\u00f5es do plano/i });
  expect(title).toBeInTheDocument();
  await actTick();
});
