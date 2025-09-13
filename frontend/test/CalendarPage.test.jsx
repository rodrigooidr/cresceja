import { render, screen } from '@testing-library/react';
import React from 'react';
import CalendarPage from '../src/pages/CalendarPage.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { OrgContext } from '../src/contexts/OrgContext.jsx';

jest.mock('../src/api/inboxApi.js');

function renderWithOrg(ui) {
  return render(
    <OrgContext.Provider value={{ selected: 'o1' }}>
      {ui}
    </OrgContext.Provider>
  );
}

test('lists events', async () => {
  inboxApi.get.mockImplementation((url) => {
    if (url.endsWith('/features')) return Promise.resolve({ data: { google_calendar_accounts: { enabled: true, limit: 1 } } });
    if (url.endsWith('/calendar/accounts')) return Promise.resolve({ data: [{ id: 'a1', display_name: 'Acc1' }] });
    if (url.includes('/calendars')) return Promise.resolve({ data: { items: [{ id: 'c1', summary: 'Cal1' }] } });
    if (url.includes('/events')) return Promise.resolve({ data: { items: [{ id: 'e1', summary: 'Meet', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' }, location: 'Room' }] } });
    return Promise.resolve({ data: {} });
  });
  renderWithOrg(<CalendarPage />);
  expect(await screen.findByText('Meet')).toBeInTheDocument();
});
