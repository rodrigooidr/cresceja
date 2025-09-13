import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import inboxApi from '../src/api/inboxApi.js';

describe('SettingsPage Facebook OAuth', () => {
  beforeEach(() => {
    inboxApi.get.mockReset();
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/facebook/pages')) return Promise.resolve({ data: [] });
      if (url.includes('/features')) return Promise.resolve({ data: { facebook_pages: { enabled: true, limit: 1, used: 0 } } });
      return Promise.resolve({ data: {} });
    });
    window.toast = jest.fn();
    delete window.location;
    window.location = { href: '', pathname: '/settings', search: '' };
  });

  test('connect button navigates to oauth start', async () => {
    render(<SettingsPage />);
    const btn = await screen.findByRole('button', { name: 'Conectar página' });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    expect(window.location.href).toBe('/api/auth/facebook/start?orgId=org_test&returnTo=/settings');
  });

  test('shows toast and refetches when connected param present', async () => {
    window.location.search = '?fb_connected=1';
    render(<SettingsPage />);
    await waitFor(() => expect(window.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Página conectada' })));
    const calls = inboxApi.get.mock.calls.filter(([url]) => url.includes('/facebook/pages'));
    expect(calls.length).toBe(2);
  });
});
