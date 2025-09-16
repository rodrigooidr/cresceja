import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';

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

describe('ContentCalendar – Race: duplo clique aborta anterior', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    setupApiMocks();
    window.analytics = { track: jest.fn() };
    window.toast = jest.fn();
  });

  afterEach(() => {
    cleanup();
    window.analytics = undefined;
    window.toast = undefined;
  });

  it('a segunda aprovação cancela a primeira e só a segunda conclui', async () => {
    inboxApi.__mock.setDelay(150);
    inboxApi.__mock.failOn(/\/marketing\/suggestions\/.+\/approve$/);

    render(<ContentCalendar />);
    const btn = await screen.findByRole('button', { name: /aprovar/i });

    fireEvent.click(btn);
    expect(btn).toBeDisabled();

    inboxApi.__mock.reset();
    setupApiMocks();
    inboxApi.__mock.setDelay(50);
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toBeEnabled());

    expect(window.toast).toHaveBeenCalled();
    const successToast = window.toast.mock.calls.find(
      ([arg]) => (arg?.title || '').toLowerCase().includes('aprovados')
    );
    expect(successToast).toBeTruthy();

    expect(window.analytics.track).toHaveBeenCalledWith(
      'marketing_approve_click',
      expect.any(Object)
    );
    expect(window.analytics.track).toHaveBeenCalledWith(
      'marketing_approve_success',
      expect.any(Object)
    );
  });
});
