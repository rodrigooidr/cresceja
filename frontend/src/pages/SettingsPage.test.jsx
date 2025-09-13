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
