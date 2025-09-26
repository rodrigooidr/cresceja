import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';
import { mockContentCalendarRoutes } from './utils/mockContentCalendarRoutes.js';

jest.mock('../src/api');
import api from '../src/api';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';

mockFeatureGate();

beforeEach(() => {
  jest.resetAllMocks();
  mockContentCalendarRoutes();
  api.get.mockImplementation((url) => {
    if (url.includes('/campaigns/') && url.endsWith('/suggestions')) {
      return Promise.resolve({ data: { items: suggestionsFixture() } });
    }
    if (url.includes('/campaigns')) {
      return Promise.resolve({ data: { items: campaignsFixture() } });
    }
    if (url.includes('/suggestions/') && url.endsWith('/jobs')) {
      return Promise.resolve({ data: jobsFixture() });
    }
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { ok: true } });
  api.patch.mockResolvedValue({ data: { ok: true } });
});

test('approve opens jobs modal', async () => {
  renderWithProviders(<ContentCalendar />);
  await screen.findByText('Sugestão IG/FB #1');
  const approveBtn = (await screen.findAllByTestId('btn-approve'))[0];
  await act(async () => {
    fireEvent.click(approveBtn);
  });
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/orgs/org-1/suggestions/sug-1/approve',
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        signal: expect.any(Object),
      })
    )
  );
  await screen.findByText('Jobs da Sugestão');
});
