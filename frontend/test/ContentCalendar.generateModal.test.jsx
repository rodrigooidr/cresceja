import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';

jest.mock('luxon', () => ({ DateTime: { fromJSDate: () => ({ toISODate: () => '2024-01-01', toFormat: () => '', plus: () => ({ toJSDate: () => new Date() }), toJSDate: () => new Date() }), fromISO: () => ({ startOf: () => ({ toISODate: () => '2024-01-01' }) }) } }));
jest.mock('react-big-calendar', () => ({ Calendar: ({ events }) => <div>{events.map(e=>e.title)}</div>, luxonLocalizer: () => ({}) }));
jest.mock('react-big-calendar/lib/addons/dragAndDrop', () => (Comp) => Comp);
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);
const mockApi = { get: jest.fn(() => Promise.resolve({ data:{ data:[] } })), post: jest.fn(), patch: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => ({ __esModule:true, default: () => ({ activeOrg:'org1' }) }));
jest.mock('../src/hooks/useToastFallback.js', () => () => jest.fn());
jest.mock('../src/auth/useAuth.js', () => ({ useAuth: () => ({ user:{ permissions:['CAN_MANAGE_CAMPAIGNS'] } }) }));

beforeEach(() => { mockApi.post.mockReset(); });

test('opens modal and posts generate', async () => {
  render(<ContentCalendar />);
  await screen.findByText('Gerar Campanha (IA)');
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar Campanha (IA)'));
  });
  fireEvent.change(screen.getByPlaceholderText('Título'), { target:{ value:'Camp' } });
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar'));
  });
  await waitFor(() => expect(mockApi.post).toHaveBeenCalled());
});
