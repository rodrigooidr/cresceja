import { render, screen, waitFor } from '@testing-library/react';
import ClientsPage from '../src/pages/clients/ClientsPage.jsx';
import inboxApi from '../src/api/inboxApi.js';

let mockSelected = '1';
jest.mock('../src/contexts/OrgContext.jsx', () => ({
  useOrg: () => ({ selected: mockSelected }),
  OrgProvider: ({ children }) => <>{children}</>,
}));
jest.mock('../src/auth/useAuth.js', () => ({
  useAuth: () => ({ user: { role: 'Admin' } }),
}));
jest.mock('../src/hooks/useWhatsApp.js', () => ({
  __esModule: true,
  default: () => ({ connected: true }),
}));

test('with selected sends X-Org-Id header', async () => {
  localStorage.setItem('active_org_id', '1');
  let captured;
  const original = inboxApi.defaults.adapter;
  inboxApi.defaults.adapter = (config) => {
    captured = config.headers['X-Org-Id'];
    return Promise.resolve({ data: [] });
  };
  render(<ClientsPage />);
  await waitFor(() => expect(captured).toBe('1'));
  inboxApi.defaults.adapter = original;
});

test('without selected shows callout', () => {
  mockSelected = null;
  localStorage.removeItem('active_org_id');
  render(<ClientsPage />);
  expect(screen.getByText('Selecione uma organização')).toBeInTheDocument();
});

