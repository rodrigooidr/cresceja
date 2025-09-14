import React from 'react';
import { render, screen } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';

jest.mock('luxon', () => ({ DateTime: { fromJSDate: () => ({ toISODate: () => '2024-01-01', toFormat: () => '', plus: () => ({ toJSDate: () => new Date() }), toJSDate: () => new Date() }) } }));
jest.mock('react-big-calendar', () => ({ Calendar: () => <div></div>, luxonLocalizer: () => ({}) }));
jest.mock('react-big-calendar/lib/addons/dragAndDrop', () => (Comp) => Comp);
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);
const mockApi = { get: jest.fn(() => Promise.resolve({ data:{ data:[] } })), post: jest.fn(), patch: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => ({ __esModule:true, default: () => ({ activeOrg:'org1' }) }));
jest.mock('../src/hooks/useToastFallback.js', () => () => jest.fn());
jest.mock('../src/auth/useAuth.js', () => ({ useAuth: () => ({ user:{ permissions:[] } }) }));

test('actions hidden when no permission', () => {
  render(<ContentCalendar />);
  expect(screen.queryByText('Gerar Campanha (IA)')).not.toBeInTheDocument();
});
