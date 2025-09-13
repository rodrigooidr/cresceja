import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from './SettingsPage.jsx';
import inboxApi from '../api/inboxApi.js';
import { OrgContext } from '../contexts/OrgContext.jsx';

jest.mock('../api/inboxApi.js');

function renderWithOrg(ui) {
  return render(
    <OrgContext.Provider value={{ selected: 'org1' }}>
      {ui}
    </OrgContext.Provider>
  );
}

test('Google Calendar block hidden when limit=0', async () => {
  inboxApi.get.mockResolvedValueOnce({ data: { google_calendar_accounts: { enabled: true, limit: 0, used: 0 } } });
  renderWithOrg(<SettingsPage />);
  await waitFor(() => expect(inboxApi.get).toHaveBeenCalled());
  expect(screen.queryByText(/Google Calendar/i)).not.toBeInTheDocument();
});

test('Google Calendar block shown when limit>0', async () => {
  inboxApi.get.mockResolvedValueOnce({ data: { google_calendar_accounts: { enabled: true, limit: 5, used: 1 } } });
  renderWithOrg(<SettingsPage />);
  await screen.findByText(/Google Calendar/i);
});

test('Instagram section render/connect/remove', async () => {
  inboxApi.get
    .mockResolvedValueOnce({ data: { google_calendar_accounts: { enabled: true, limit: 0, used: 0 } } })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: { instagram_accounts: { enabled: true, limit: 2, used: 0 } } });
  inboxApi.delete.mockResolvedValue({});
  renderWithOrg(<SettingsPage />);
  await screen.findByText(/Instagram/i);
  const btn = screen.getByText('Conectar conta');
  const old = window.location;
  delete window.location;
  window.location = { href: '' };
  btn.click();
  expect(window.location.href).toContain('/api/auth/instagram/start');
  window.location = old;

  inboxApi.get
    .mockResolvedValueOnce({ data: [{ id: '1', ig_user_id: 'u', username: 'u', name: 'n', is_active: true }] })
    .mockResolvedValueOnce({ data: { instagram_accounts: { enabled: true, limit: 2, used: 1 } } });
  renderWithOrg(<SettingsPage />);
  await screen.findByText('Remover');
  screen.getByText('Remover').click();
  await waitFor(() => expect(inboxApi.delete).toHaveBeenCalled());
});
