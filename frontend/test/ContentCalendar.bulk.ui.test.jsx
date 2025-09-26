import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import api from '../src/api';
import inboxApi from '../src/api/inboxApi';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';
import { campaignsFixture, suggestionsFixture } from './fixtures/calendar.fixtures.js';
import {
  registerContentCalendarRoutes,
  setupContentCalendarRoutes,
} from './utils/mockContentCalendarRoutes.js';

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');

mockFeatureGate();
setupContentCalendarRoutes();

describe('ContentCalendar – Bulk UI', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    registerContentCalendarRoutes();
    inboxApi.__mock?.setDelay?.(20);
    window.toast = jest.fn();

    api.get.mockImplementation((url) => {
      if (url === '/marketing/content/jobs') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'job-1', title: 'Post A', suggestionId: 'sug-1' },
              { id: 'job-2', title: 'Post B', suggestionId: 'sug-2' },
              { id: 'job-3', title: 'Post C', suggestionId: 'sug-1' },
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
      return Promise.resolve({ data: {} });
    });

    api.post.mockImplementation((url, payload) => {
      if (url === '/marketing/content/approve') {
        return Promise.resolve({ data: { ok: true, received: payload } });
      }
      if (/^\/orgs\/org-1\/suggestions\//.test(url)) {
        return Promise.resolve({ data: { ok: true } });
      }
      return Promise.resolve({ data: { ok: true } });
    });

    api.patch.mockResolvedValue({ data: { ok: true } });
  });

  afterEach(() => {
    inboxApi.__mock?.reset?.();
  });

  it('inicia bulk, mostra progresso e permite cancelar', async () => {
    inboxApi.__mock?.setDelay?.(120);
    const superAdmin = { role: 'OrgOwner', roles: ['SuperAdmin'] };
    renderWithProviders(<ContentCalendar currentUser={superAdmin} bulkConcurrency={2} />);

    const job1 = await screen.findByTestId('job-checkbox-job-1');
    const job2 = await screen.findByTestId('job-checkbox-job-2');
    const job3 = await screen.findByTestId('job-checkbox-job-3');

    fireEvent.click(job1);
    fireEvent.click(job2);
    fireEvent.click(job3);

    const start = await screen.findByTestId('bulk-start');
    fireEvent.click(start);

    const progress = await screen.findByTestId('bulk-progress');
    expect(progress.textContent).toMatch(/Aprovando/i);

    const cancel = await screen.findByTestId('bulk-cancel');
    fireEvent.click(cancel);

    await waitFor(() => expect(screen.getByTestId('bulk-bar')).toBeInTheDocument());
  });

  it('lida com parcial em itens selecionados', async () => {
    inboxApi.__mock?.setDelay?.(0);
    inboxApi.__mock?.failWith?.(/\/marketing\/suggestions\/sug-2\/approve$/, { status: 503 });

    const superAdmin = { role: 'OrgOwner', roles: ['SuperAdmin'] };
    renderWithProviders(<ContentCalendar currentUser={superAdmin} />);

    const job1 = await screen.findByTestId('job-checkbox-job-1');
    const job2 = await screen.findByTestId('job-checkbox-job-2');

    fireEvent.click(job1);
    fireEvent.click(job2);

    fireEvent.click(await screen.findByTestId('bulk-start'));

    await screen.findByTestId('bulk-progress');

    await waitFor(() => expect(screen.getByTestId('bulk-start')).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByTestId('job-checkbox-job-1')).not.toBeChecked();
    expect(screen.getByTestId('job-checkbox-job-2')).toBeChecked();
  });
});
