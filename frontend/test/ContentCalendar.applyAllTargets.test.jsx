import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';
import { setupContentCalendarRoutes } from './utils/mockContentCalendarRoutes.js';

jest.mock('../src/api');
import api from '../src/api';
import { campaignsFixture } from './fixtures/calendar.fixtures.js';

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

test('Todos IG applies targets in suggested', async () => {
  renderWithProviders(<ContentCalendar />);
  await screen.findByText('Outubro • Loja XYZ');
  const btn = await screen.findByTestId('btn-apply-ig');
  await act(async () => {
    fireEvent.click(btn);
  });
  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledWith(
      '/orgs/org-1/campaigns/camp-1/suggestions/apply-targets',
      { ig: { enabled: true }, onlyStatus: ['suggested'] }
    );
  });
});
