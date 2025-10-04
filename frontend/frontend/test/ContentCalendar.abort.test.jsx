import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';
import { mockContentCalendarRoutes } from './utils/mockContentCalendarRoutes.js';

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');

import api from '../src/api';
import inboxApi from '../src/api/inboxApi.js';

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
  api.post.mockImplementation((url, payload, config) => inboxApi.post(url, payload, config));
  api.patch.mockResolvedValue({ data: { ok: true } });
}

describe('ContentCalendar – Abort on unmount', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    mockContentCalendarRoutes();
    setupApiMocks();
    inboxApi.__mock.setDelay(200);
    window.toast = jest.fn();
  });

  afterEach(() => {
    cleanup();
    window.toast = undefined;
  });

  it('não mostra erro nem sucesso após unmount (AbortError silencioso)', async () => {
    const { unmount } = render(<ContentCalendar />);
    const btn = await screen.findByRole('button', { name: /aprovar/i });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(window.toast).not.toHaveBeenCalled();
  });
});
