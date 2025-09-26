import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';
import { mockContentCalendarRoutes } from './utils/mockContentCalendarRoutes.js';

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');

import api from '../src/api';
import inboxApi from '../src/api/inboxApi.js';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';

mockFeatureGate();

describe('ContentCalendar – Erros de aprovação', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    mockContentCalendarRoutes();
    window.toast?.mockClear?.();

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

    api.post.mockImplementation((url) => {
      if (url === '/marketing/content/approve') {
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error('fail job')), 20)
        );
      }
      return Promise.resolve({ data: { ok: true } });
    });

    api.patch.mockResolvedValue({ data: { ok: true } });
  });

  it('mostra toast de erro e reabilita botão quando aprovação falha', async () => {
    renderWithProviders(<ContentCalendar />);

    await screen.findByText('Sugestão IG/FB #1');
    const button = await screen.findByTestId('btn-approve');
    expect(button).toBeEnabled();

    api.post.mockClear();
    window.toast?.mockClear?.();

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeDisabled());
    const busyButton = screen.getByTestId('btn-approve');
    expect(busyButton).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeEnabled());
    const finalButton = screen.getByTestId('btn-approve');
    expect(finalButton).toHaveAttribute('aria-busy', 'false');
    expect(finalButton).toHaveTextContent('Aprovar');

    await waitFor(() => {
      expect(window.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Não foi possível aprovar. Tente novamente.' })
      );
    });

    const approveCalls = api.post.mock.calls.filter(([url]) => url === '/marketing/content/approve');
    expect(approveCalls.length).toBeGreaterThan(0);

    const suggestionCalls = api.post.mock.calls.filter(([url]) => url.includes('/suggestions/'));
    expect(suggestionCalls.length).toBeGreaterThan(0);

    expect(screen.queryByText('Jobs da Sugestão')).not.toBeInTheDocument();
  });
});
