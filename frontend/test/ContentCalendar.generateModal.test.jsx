import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';
import { setupContentCalendarRoutes } from './utils/mockContentCalendarRoutes.js';

jest.mock('../src/api');
import api from '../src/api';
import { campaignsFixture } from './fixtures/calendar.fixtures.js';

jest.mock('luxon', () => ({ DateTime: { fromJSDate: () => ({ toISODate: () => '2024-01-01', toFormat: () => '', plus: () => ({ toJSDate: () => new Date() }), toJSDate: () => new Date() }), fromISO: () => ({ startOf: () => ({ toISODate: () => '2024-01-01' }) }) } }));
jest.mock('react-big-calendar', () => ({ Calendar: ({ events }) => <div>{events.map(e=>e.title)}</div>, luxonLocalizer: () => ({}) }));
jest.mock('react-big-calendar/lib/addons/dragAndDrop', () => (Comp) => Comp);

mockFeatureGate();
setupContentCalendarRoutes();

beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockImplementation((url) => {
    if (url.includes('/campaigns/') && url.endsWith('/suggestions')) {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url.includes('/campaigns')) {
      return Promise.resolve({ data: { items: campaignsFixture() } });
    }
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { ok: true } });
  api.patch.mockResolvedValue({ data: { ok: true } });
});

test('opens modal and posts generate', async () => {
  renderWithProviders(<ContentCalendar />);
  const btn = await screen.findByTestId('btn-generate-campaign');
  await act(async () => {
    fireEvent.click(btn);
  });
  fireEvent.change(screen.getByPlaceholderText('Título'), { target:{ value:'Camp' } });
  await act(async () => {
    fireEvent.click(screen.getByText('Gerar'));
  });
  await waitFor(() => expect(api.post).toHaveBeenCalled());
});
