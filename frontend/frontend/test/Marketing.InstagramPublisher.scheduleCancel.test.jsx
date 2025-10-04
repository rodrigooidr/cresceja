import { render, screen, fireEvent } from '@testing-library/react';
import InstagramPublisher from '../src/pages/marketing/InstagramPublisher.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { OrgContext } from '../src/contexts/OrgContext.jsx';

jest.mock('../src/api/inboxApi.js');

function renderWithOrg(ui){
  return render(<OrgContext.Provider value={{ selected: 'org1' }}>{ui}</OrgContext.Provider>);
}

test('cancel job action', async () => {
  inboxApi.get
    .mockResolvedValueOnce({ data: [{ id:'acc1' }] })
    .mockResolvedValueOnce({ data: [{ id:'j1', type:'image', status:'pending', scheduled_at:'2024-01-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' }] })
    .mockResolvedValueOnce({ data: [] });
  inboxApi.patch = jest.fn().mockResolvedValueOnce({});
  renderWithOrg(<InstagramPublisher />);
  await screen.findByTestId('jobs-table');
  fireEvent.click(screen.getByText('Cancelar'));
  expect(inboxApi.patch).toHaveBeenCalledWith('/orgs/org1/instagram/jobs/j1', { status:'canceled' });
});

test('reschedule job action', async () => {
  window.prompt = jest.fn().mockReturnValue('2025-01-01T00:00');
  inboxApi.get
    .mockResolvedValueOnce({ data: [{ id:'acc1' }] })
    .mockResolvedValueOnce({ data: [{ id:'j1', type:'image', status:'pending', scheduled_at:'2024-01-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' }] })
    .mockResolvedValueOnce({ data: [] });
  inboxApi.patch = jest.fn().mockResolvedValueOnce({});
  renderWithOrg(<InstagramPublisher />);
  await screen.findByTestId('jobs-table');
  fireEvent.click(screen.getByText('Reagendar'));
  expect(inboxApi.patch).toHaveBeenCalledWith('/orgs/org1/instagram/jobs/j1', { scheduled_at: new Date('2025-01-01T00:00').toISOString() });
});
