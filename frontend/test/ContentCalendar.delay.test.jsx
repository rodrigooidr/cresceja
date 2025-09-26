import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');

import api from '../src/api';
import inboxApi from '../src/api/inboxApi.js';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';
import {
  registerContentCalendarRoutes,
  setupContentCalendarRoutes,
} from './utils/mockContentCalendarRoutes.js';

mockFeatureGate();
setupContentCalendarRoutes();

function setupApiMocks() {
  api.get.mockImplementation((url) => {
    if (url === '/marketing/content/jobs') {
      return Promise.resolve({
        data: {
          items: [
            { id: 'job-1', title: 'Post A', suggestionId: 'sug-1' },
            { id: 'job-2', title: 'Post B', suggestionId: 'sug-2' },
          ],
        },
      });
    }
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
  api.patch.mockResolvedValue({ data: { ok: true } });
  api.post.mockImplementation((url, payload, config) => inboxApi.post(url, payload, config));
}

describe('ContentCalendar – Delay/Spinner', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    registerContentCalendarRoutes();
    setupApiMocks();
    window.toast?.mockClear?.();
  });

  it('mantém botão desabilitado durante atraso simulado', async () => {
    inboxApi.__mock.setDelay(300);

    renderWithProviders(<ContentCalendar />);

    await screen.findByText('Sugestão IG/FB #1');
    const approveButton = await screen.findByTestId('btn-approve');

    fireEvent.click(approveButton);

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeDisabled());
    const busyButton = screen.getByTestId('btn-approve');
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
  });
});
