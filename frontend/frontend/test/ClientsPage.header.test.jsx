import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import ClientsPage from '../src/pages/clients/ClientsPage.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders';

jest.mock('../src/api/inboxApi.js');
import inboxApi, { __getLastRequest } from '../src/api/inboxApi.js';

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/useWhatsApp.js', () => ({
  __esModule: true,
  default: () => ({ connected: true }),
}));

test('with selected sends X-Org-Id header', async () => {
  localStorage.setItem('activeOrgId', '1');
  renderWithRouterProviders(<ClientsPage />, { org: { selected: '1', orgs: [{ id: '1', name: 'Org One' }] } });
  await waitFor(() => expect(__getLastRequest()).not.toBeNull());
  expect(__getLastRequest().headers['X-Org-Id']).toBe('1');
});

test('without selected shows callout', async () => {
  localStorage.removeItem('activeOrgId');
  localStorage.removeItem('active_org_id');
  renderWithRouterProviders(<ClientsPage />, { org: { selected: null, orgs: [] } });
  expect(await screen.findByText('Selecione uma organização')).toBeInTheDocument();
});

