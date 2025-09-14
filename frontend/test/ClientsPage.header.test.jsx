import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import ClientsPage from '../src/pages/clients/ClientsPage.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders';

jest.mock('../src/api/inboxApi.js', () => jest.requireActual('../src/api/inboxApi.js'));
import inboxApi from '../src/api/inboxApi.js';

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/useWhatsApp.js', () => ({
  __esModule: true,
  default: () => ({ connected: true }),
}));

test('with selected sends X-Org-Id header', async () => {
  localStorage.setItem('active_org_id', '1');
  let captured;
  const original = inboxApi.defaults.adapter;
  inboxApi.defaults.adapter = (config) => {
    const h = config.headers || {};
    captured = h['X-Org-Id'] || h['x-org-id'] || (typeof h.get === 'function' ? h.get('X-Org-Id') : undefined);
    return Promise.resolve({ data: [] });
  };
  renderWithRouterProviders(<ClientsPage />, { org: { selected: '1', orgs: [{ id: '1', name: 'Org One' }] } });
  await waitFor(() => expect(captured).toBe('1'));
  inboxApi.defaults.adapter = original;
});

test('without selected shows callout', async () => {
  localStorage.removeItem('active_org_id');
  renderWithRouterProviders(<ClientsPage />, { org: { selected: null, orgs: [] } });
  expect(await screen.findByText('Selecione uma organização')).toBeInTheDocument();
});

