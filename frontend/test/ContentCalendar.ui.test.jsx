import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import * as perm from '../src/auth/perm.js';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');

import api from '../src/api';
import inboxApi from '../src/api/inboxApi.js';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';

mockFeatureGate();

describe('ContentCalendar – Aprovar (UI)', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
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

    api.post.mockImplementation((url, payload) => {
      if (url === '/marketing/content/approve') {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ data: { ok: true, received: payload } }), 20)
        );
      }
      if (/^\/orgs\/org-1\/suggestions\//.test(url)) {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ data: { ok: true } }), 20)
        );
      }
      return Promise.resolve({ data: { ok: true } });
    });

    api.patch.mockResolvedValue({ data: { ok: true } });
  });

  it('desabilita botão durante aprovação e abre modal após sucesso', async () => {
    renderWithProviders(<ContentCalendar />);

    await screen.findByText('Sugestão IG/FB #1');
    const button = await screen.findByTestId('btn-approve');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'false');

    api.post.mockClear();
    window.toast?.mockClear?.();

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeDisabled());
    const busyButton = screen.getByTestId('btn-approve');
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    expect(busyButton.textContent).toMatch(/Aprovando/);

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeEnabled());
    const finalButton = screen.getByTestId('btn-approve');
    expect(finalButton).toHaveAttribute('aria-busy', 'false');
    expect(finalButton).toHaveTextContent('Aprovar');

    await waitFor(() => {
      const approveCall = api.post.mock.calls.find(([url]) => url === '/marketing/content/approve');
      expect(approveCall).toBeDefined();
      expect(approveCall[1]).toEqual({ ids: ['job-1', 'job-2'] });
    });

    expect(
      api.post.mock.calls.some(([url]) => url === '/orgs/org-1/suggestions/sug-1/approve')
    ).toBe(true);

    await waitFor(() => {
      expect(window.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Jobs aprovados com sucesso.' })
      );
    });

    await screen.findByText('Jobs da Sugestão');
  });

  it('exibe região de status para leitores de tela', async () => {
    renderWithProviders(<ContentCalendar />);

    const statusRegion = await screen.findByRole('status');
    expect(statusRegion).toBeInTheDocument();

    const button = await screen.findByTestId('btn-approve');

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(statusRegion.textContent).toContain('Aprovando');
    });
  });

  it('não mostra botão Aprovar quando canApprove retorna false', async () => {
    const spy = jest.spyOn(perm, 'canApprove').mockReturnValue(false);
    try {
      renderWithProviders(<ContentCalendar />);
      await waitFor(() => {
        expect(screen.queryByTestId('btn-approve')).toBeNull();
      });
    } finally {
      spy.mockRestore();
    }
  });
});
