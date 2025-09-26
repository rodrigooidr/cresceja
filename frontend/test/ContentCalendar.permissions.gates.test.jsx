import React from 'react';
import { screen } from '@testing-library/react';
import ContentCalendar, { isDnDEnabledForUser } from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders } from './utils/renderWithProviders.jsx';
import { setupContentCalendarRoutes } from './utils/mockContentCalendarRoutes.js';

jest.mock('luxon', () => ({ DateTime: { fromJSDate: () => ({ toISODate: () => '2024-01-01', toFormat: () => '', plus: () => ({ toJSDate: () => new Date() }), toJSDate: () => new Date() }) } }));
jest.mock('react-big-calendar', () => ({ Calendar: () => <div></div>, luxonLocalizer: () => ({}) }));
jest.mock('react-big-calendar/lib/addons/dragAndDrop', () => (Comp) => Comp);
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ children }) => <>{children}</>);
const mockApi = { get: jest.fn(() => Promise.resolve({ data:{ data:[] } })), post: jest.fn(), patch: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
jest.mock('../src/hooks/useActiveOrg.js', () => ({ __esModule:true, default: () => ({ activeOrg:'org1' }) }));
jest.mock('../src/hooks/useToastFallback.js', () => () => jest.fn());

setupContentCalendarRoutes();

test('Agent não vê ações de campanha e dnd desabilita', async () => {
  const agent = { id:'u2', name:'Agent', role:'Agent', org_id:'org-1' };

  renderWithProviders(<ContentCalendar />, { user: agent, features: { has: () => true } });

  // header actions não existem
  expect(screen.queryByTestId('btn-generate-campaign')).toBeNull();
  expect(screen.queryByTestId('btn-apply-ig')).toBeNull();
  expect(screen.queryByTestId('btn-apply-fb')).toBeNull();

  // ações do card também ocultas
  expect(screen.queryByTestId('btn-approve')).toBeNull();
  expect(screen.queryByTestId('btn-reject')).toBeNull();
  expect(screen.queryByTestId('btn-jobs')).toBeNull();

  // fn pura para checar DnD
  expect(isDnDEnabledForUser(agent)).toBe(false);
});
