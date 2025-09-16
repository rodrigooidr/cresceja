import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ContentCalendar from '../src/pages/marketing/ContentCalendar.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');

import api from '../src/api';
import inboxApi from '../src/api/inboxApi.js';
import { campaignsFixture, suggestionsFixture, jobsFixture } from './fixtures/calendar.fixtures.js';

mockFeatureGate();

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

describe('ContentCalendar – Aprovação parcial + retry', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    setupApiMocks();
    window.toast?.mockClear?.();
  });

  it('mostra alerta em parcial e permite Tentar novamente', async () => {
    inboxApi.__mock.failOn(/\/orgs\/.*\/suggestions\/.*\/approve$/);

    renderWithProviders(<ContentCalendar />);

    await screen.findByText('Sugestão IG/FB #1');
    const approveButton = await screen.findByTestId('btn-approve');

    fireEvent.click(approveButton);

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeDisabled());
    const busyButton = screen.getByTestId('btn-approve');
    expect(busyButton).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeEnabled());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/falha ao aprovar parte dos itens/i);

    await waitFor(() =>
      expect(window.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Aprovação parcial: tente novamente.' })
      )
    );

    inboxApi.__mock.reset();
    setupApiMocks();
    window.toast?.mockClear?.();

    const retryButton = screen.getByRole('button', { name: /tentar novamente/i });
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeDisabled());

    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeEnabled());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

    await waitFor(() =>
      expect(window.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Jobs aprovados com sucesso.' })
      )
    );
  });
});
