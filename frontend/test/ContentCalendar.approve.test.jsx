import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';

jest.mock('react-big-calendar', () => ({
  Calendar: ({ events, components }) => (
    <div data-testid="calendar">{events.map(ev => <div key={ev.id}>{components.event({ event: ev })}</div>)}</div>
  ),
  luxonLocalizer: () => ({})
}));
jest.mock('react-big-calendar/lib/addons/dragAndDrop', () => (Comp) => (props) => <Comp {...props} />);
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);

const mockApi = { get: jest.fn(), post: jest.fn(), patch: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => () => ({ activeOrg: '1' }));
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);

test('approve shows badge and opens jobs modal', async () => {
  mockApi.get
    .mockResolvedValueOnce({ data: { data: [{ id: 'c1', title: 'Camp' }] } })
    .mockResolvedValueOnce({ data: { data: [{ id: 's1', date: '2024-01-01', time: '12:00', copy_json: { headline: 'Sugestão' }, status: 'suggested' }] } })
    .mockResolvedValueOnce({ data: { data: [{ id: 's1', date: '2024-01-01', time: '12:00', copy_json: { headline: 'Sugestão' }, status: 'approved' }] } })
    .mockResolvedValue({ data: {} });
  mockApi.post.mockResolvedValue({});

  render(<ContentCalendar />);

  const approveBtn = await screen.findByText('Aprovar');
  await act(async () => {
    fireEvent.click(approveBtn);
  });

  await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/orgs/1/suggestions/s1/approve'));

  await screen.findByText('Agendado');
  await screen.findByText('Jobs da Sugestão');
});
