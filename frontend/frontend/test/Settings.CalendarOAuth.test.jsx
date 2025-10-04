import { screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders';

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));

describe('SettingsPage Google Calendar OAuth', () => {
  beforeEach(() => {
    inboxApi.get.mockClear();
    global.setFeatureGate({ calendar: true, facebook: false, instagram: false, whatsapp: true }, { calendar: 1, facebook_pages: 0, instagram_accounts: 0, wa_numbers: 1 });
    window.toast = jest.fn();
    delete window.location;
    window.location = { href: '', pathname: '/settings', search: '' };
  });

  test('connect button navigates to oauth start', async () => {
    renderWithRouterProviders(<SettingsPage />, { org: { selected: 'org_test', orgs: [{ id: 'org_test', name: 'Org Test' }] } });
    const btn = await screen.findByTestId('calendar-connect');
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    expect(window.location.href).toBe('/api/auth/google/start?orgId=org_test&returnTo=/settings');
  });

  test('shows toast and refetches when connected param present', async () => {
    window.location.search = '?connected=1';
    renderWithRouterProviders(<SettingsPage />, { org: { selected: 'org_test', orgs: [{ id: 'org_test', name: 'Org Test' }] } });
    await waitFor(() => expect(window.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Conta conectada' })));
    const accountCalls = inboxApi.get.mock.calls.filter(([url]) => url.includes('/calendar/accounts'));
    expect(accountCalls.length).toBe(2);
  });
});
