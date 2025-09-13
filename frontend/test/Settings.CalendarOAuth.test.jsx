import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import inboxApi from '../src/api/inboxApi.js';

describe('SettingsPage Google Calendar OAuth', () => {
  beforeEach(() => {
    inboxApi.get.mockReset();
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/calendar/accounts')) return Promise.resolve({ data: [] });
      if (url.includes('/features')) return Promise.resolve({ data: { google_calendar_accounts: { enabled: true, limit: 1, used: 0 } } });
      return Promise.resolve({ data: {} });
    });
    window.toast = jest.fn();
    delete window.location;
    window.location = { href: '', pathname: '/settings', search: '' };
  });

  test('connect button navigates to oauth start', async () => {
    render(<SettingsPage />);
    const btn = await screen.findByRole('button', { name: 'Conectar conta' });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    expect(window.location.href).toBe('/api/auth/google/start?orgId=org_test&returnTo=/settings');
  });

  test('shows toast and refetches when connected param present', async () => {
    window.location.search = '?connected=1';
    render(<SettingsPage />);
    await waitFor(() => expect(window.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Conta conectada' })));
    const accountCalls = inboxApi.get.mock.calls.filter(([url]) => url.includes('/calendar/accounts'));
    expect(accountCalls.length).toBe(2);
  });
});
