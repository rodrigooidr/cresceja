import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContentCalendar from './ContentCalendar.jsx';

const mockGet = jest.fn();
const mockPatch = jest.fn();

jest.mock('../../contexts/useApi.js', () => ({
  useApi: () => ({ get: mockGet, patch: mockPatch, post: jest.fn() })
}));

jest.mock('../../hooks/useActiveOrg.js', () => () => ({ activeOrg: '1' }));

test('Todos IG applies targets in suggested', async () => {
  mockGet
    .mockResolvedValueOnce({ data: { data: [{ id:'10', title:'Camp' }] } }) // campaigns
    .mockResolvedValueOnce({ data: { data: [{ id:'s1', date:'2024-01-01', time:'10:00', copy_json:{ text:'hi' } }] } }) // suggestions
    .mockResolvedValueOnce({ data: { data: [] } }); // after patch
  mockPatch.mockResolvedValueOnce({ data: { updated:1 } });

  render(<ContentCalendar />);

  await screen.findByText('Camp');
  fireEvent.change(screen.getByRole('combobox'), { target:{ value:'10' } });
  await screen.findByText('hi');

  fireEvent.click(screen.getByText('Todos Instagram'));

  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith(
      '/orgs/1/campaigns/10/suggestions/apply-targets',
      { ig:{ enabled:true }, onlyStatus:['suggested'] }
    );
  });

  expect(mockGet).toHaveBeenCalledTimes(3);
});
