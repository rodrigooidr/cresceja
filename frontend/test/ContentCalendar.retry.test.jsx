import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';
import {
  registerContentCalendarRoutes,
  setupContentCalendarRoutes,
} from './utils/mockContentCalendarRoutes.js';

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

describe('ContentCalendar – retry e abort respeitando sinal', () => {
  setupContentCalendarRoutes();
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    registerContentCalendarRoutes();
    setupApiMocks();
    window.analytics = { track: jest.fn() };
    window.toast = jest.fn();
  });

  afterEach(() => {
    cleanup();
    window.analytics = undefined;
    window.toast = undefined;
  });

  it('falha 2x na sugestão (429) e conclui após retry', async () => {
    inboxApi.__mock.failNTimes(/\/orgs\/[^/]+\/suggestions\/[^/]+\/approve$/, 2, {
      status: 429,
      message: 'rate limit',
    });

    render(<ContentCalendar />);
    await screen.findByText('Sugestão IG/FB #1');
    const approveButton = await screen.findByTestId('btn-approve');

    fireEvent.click(approveButton);
    expect(approveButton).toBeDisabled();

    await waitFor(() => expect(approveButton).toBeEnabled(), { timeout: 4000 });

    const successToast = window.toast.mock.calls.find(
      ([arg]) => (arg?.title || '').toLowerCase().includes('aprovados')
    );
    expect(successToast).toBeTruthy();

    expect(window.analytics.track).toHaveBeenCalledWith(
      'marketing_approve_job_attempt',
      expect.objectContaining({ attempt: expect.any(Number) })
    );
    expect(window.analytics.track).toHaveBeenCalledWith(
      'marketing_approve_suggestion_attempt',
      expect.objectContaining({ attempt: expect.any(Number) })
    );
  });

  it('aborta entre tentativas e não mostra toasts', async () => {
    inboxApi.__mock.failNTimes(/\/marketing\/content\/approve$/, 3, { status: 503 });

    const { unmount } = render(<ContentCalendar />);
    await screen.findByText('Sugestão IG/FB #1');
    const approveButton = await screen.findByTestId('btn-approve');

    fireEvent.click(approveButton);
    expect(approveButton).toBeDisabled();

    unmount();

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(window.toast).not.toHaveBeenCalled();
  });
});
