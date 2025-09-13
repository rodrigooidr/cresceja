import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import inboxApi from '../src/api/inboxApi.js';

describe('SettingsPage Google Calendar section', () => {
  beforeEach(() => {
    inboxApi.get.mockReset();
    inboxApi.delete.mockReset();
  });

  test('renders section with add button enabled', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/calendar/accounts')) return Promise.resolve({ data: [] });
      if (url.includes('/features')) return Promise.resolve({ data: { google_calendar_accounts: { enabled: true, limit: 1, used: 0 } } });
      return Promise.resolve({ data: {} });
    });

    render(<SettingsPage />);

    await screen.findByText(/Usados: 0 \/ 1/);
    const addBtn = await screen.findByRole('button', { name: 'Conectar conta' });
    expect(addBtn).toBeEnabled();
  });

  test.each([
    { enabled: true, limit: 0, used: 0 },
    { enabled: false, limit: 1, used: 0 },
  ])('section hidden when disabled or limit=0', async (feature) => {
    inboxApi.get.mockResolvedValueOnce({ data: { google_calendar_accounts: feature } });
    render(<SettingsPage />);
    await waitFor(() => expect(inboxApi.get).toHaveBeenCalled());
    expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
  });

  test('button disabled when limit reached', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/calendar/accounts')) return Promise.resolve({ data: [{ id: '1', google_user_id: 'g1', email: 'a@a.com', display_name: 'A', is_active: true }] });
      if (url.includes('/features')) return Promise.resolve({ data: { google_calendar_accounts: { enabled: true, limit: 1, used: 1 } } });
      return Promise.resolve({ data: {} });
    });

    render(<SettingsPage />);

    await screen.findByText('Google Calendar');
    const addBtn = await screen.findByText('Adicionar outra conta');
    expect(addBtn).toBeDisabled();
    expect(screen.getByText(/Limite do plano atingido/)).toBeInTheDocument();
  });
});
