import { render, screen, fireEvent } from '@testing-library/react';
import CalendarPage from '../src/pages/CalendarPage.jsx';
import inboxApi from '../src/api/inboxApi.js';

jest.mock('../src/api/inboxApi.js');

describe('CalendarPage events', () => {
  beforeEach(() => {
    inboxApi.get.mockReset();
  });

  test('loads events after clicking', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.endsWith('/features')) return Promise.resolve({ data: { google_calendar_accounts: { enabled: true, limit: 1 } } });
      if (url.endsWith('/calendar/accounts')) return Promise.resolve({ data: [{ id: 'a1', display_name: 'Acc1' }] });
      if (url.includes('/calendars')) return Promise.resolve({ data: [{ id: 'c1', summary: 'Cal1' }] });
      if (url.includes('/events')) return Promise.resolve({ data: [{ id: 'e1', summary: 'Meet', start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z', location: 'Room', status: 'confirmed' }] });
      return Promise.resolve({ data: {} });
    });
    render(<CalendarPage />);
    await screen.findByText('Cal1');
    fireEvent.click(screen.getByRole('button', { name: 'Carregar eventos' }));
    expect(await screen.findByText('Meet')).toBeInTheDocument();
  });

  test('shows error when calendar not selected', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.endsWith('/features')) return Promise.resolve({ data: { google_calendar_accounts: { enabled: true, limit: 1 } } });
      if (url.endsWith('/calendar/accounts')) return Promise.resolve({ data: [{ id: 'a1', display_name: 'Acc1' }] });
      if (url.includes('/calendars')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    render(<CalendarPage />);
    const btn = await screen.findByRole('button', { name: 'Carregar eventos' });
    fireEvent.click(btn);
    expect(await screen.findByRole('alert')).toHaveTextContent('Obrigatório');
  });
});
