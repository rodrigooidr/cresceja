import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import SuggestionJobsModal from '../src/pages/marketing/components/SuggestionJobsModal.jsx';
import { renderWithProviders, mockFeatureGate } from './utils/renderWithProviders.jsx';

jest.mock('../src/api');
import api from '../src/api';
import { jobsFixture } from './fixtures/calendar.fixtures.js';

mockFeatureGate();

beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockResolvedValue({ data: jobsFixture() });
  api.post.mockResolvedValue({ data: { ok: true } });
  api.patch.mockResolvedValue({ data: { ok: true } });
});

test('cancel and reschedule jobs', async () => {
  const onChanged = jest.fn();
  renderWithProviders(
    <SuggestionJobsModal orgId="org-1" suggestionId="sug-1" onClose={() => {}} onChanged={onChanged} />,
    { routes: false }
  );
  await screen.findByText('IG');
  await screen.findByText(/Status:/i);
  await act(async () => {
    fireEvent.click(screen.getAllByText('Cancelar')[0]);
  });
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/orgs/org-1/instagram/jobs/ig-job-1', { action: 'cancel' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());

  api.patch.mockClear();
  onChanged.mockClear();

  const inputs = document.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(inputs[0], { target: { value: '2025-10-10T10:00' } });
  await act(async () => {
    fireEvent.click(screen.getAllByText('Reagendar')[0]);
  });
  await waitFor(() => expect(api.patch).toHaveBeenCalled());
  expect(api.patch.mock.calls[0][0]).toBe('/orgs/org-1/instagram/jobs/ig-job-1');
  expect(api.patch.mock.calls[0][1].action).toBe('reschedule');
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
