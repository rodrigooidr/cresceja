import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';

jest.mock('react-big-calendar', () => ({
  Calendar: ({ events, components }) => <div>{events.map(ev => <div key={ev.id}>{components.event({ event: ev })}</div>)}</div>,
  luxonLocalizer: () => ({})
}));
jest.mock('react-big-calendar/lib/addons/dragAndDrop', () => (Comp) => (props) => <Comp {...props} />);
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);

const mockApi = { get: jest.fn(), patch: jest.fn(), post: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => () => ({ activeOrg: '1' }));
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);

test('Todos IG applies targets in suggested', async () => {
  mockApi.get.mockImplementation((url) => {
    if (url === '/orgs/1/campaigns') return Promise.resolve({ data: { data: [{ id: '10', title: 'Camp' }] } });
    if (url === '/orgs/1/campaigns/10/suggestions') return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: { data: [] } });
  });
  mockApi.patch.mockResolvedValue({});

  render(<ContentCalendar />);

  await screen.findByText('Camp');
  await screen.findByText('Todos Instagram');
  await act(async () => {
    fireEvent.click(screen.getByText('Todos Instagram'));
  });

  await waitFor(() => {
    expect(mockApi.patch).toHaveBeenCalledWith(
      '/orgs/1/campaigns/10/suggestions/apply-targets',
      { ig: { enabled: true }, onlyStatus: ['suggested'] }
    );
  });
});
