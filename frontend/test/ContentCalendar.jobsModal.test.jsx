import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuggestionJobsModal from '../src/pages/marketing/components/SuggestionJobsModal.jsx';

const mockApi = { get: jest.fn(), patch: jest.fn() };
jest.mock('../src/contexts/useApi.js', () => ({ useApi: () => mockApi }));
const mockToast = jest.fn();
jest.mock('../src/hooks/useToastFallback.js', () => () => mockToast);

test('cancel and reschedule jobs', async () => {
  mockApi.get.mockResolvedValue({ data: { ig: { jobId: 'i1', status: 'pending' }, fb: { jobId: 'f1', status: 'pending' } } });
  const onChanged = jest.fn();
  render(<SuggestionJobsModal orgId="1" suggestionId="99" onClose={() => {}} onChanged={onChanged} />);
  await screen.findByText('IG');

  fireEvent.click(screen.getAllByText('Cancelar')[0]);
  await waitFor(() => expect(mockApi.patch).toHaveBeenCalledWith('/orgs/1/instagram/jobs/i1', { action: 'cancel' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());

  mockApi.patch.mockClear();
  onChanged.mockClear();

  const inputs = document.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(inputs[1], { target: { value: '2024-05-01T10:00' } });
  fireEvent.click(screen.getAllByText('Reagendar')[1]);
  await waitFor(() => expect(mockApi.patch).toHaveBeenCalled());
  expect(mockApi.patch.mock.calls[0][0]).toBe('/orgs/1/facebook/jobs/f1');
  expect(mockApi.patch.mock.calls[0][1].action).toBe('reschedule');
  expect(mockToast).toHaveBeenCalled();
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
