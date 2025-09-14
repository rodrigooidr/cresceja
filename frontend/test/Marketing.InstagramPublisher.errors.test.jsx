import { mapApiErrorToForm } from '../src/ui/errors/mapApiError.js';

test('maps instagram related errors', () => {
  const setError = jest.fn();
  expect(mapApiErrorToForm({ response:{ data:{ error:'ig_quota_reached' } } }, setError).toast).toMatch(/Instagram/);
  expect(mapApiErrorToForm({ response:{ data:{ error:'reauth_required' } } }, setError).toast).toMatch(/Reautorização/);
  expect(mapApiErrorToForm({ response:{ data:{ error:'duplicate_job' } } }, setError).toast).toMatch(/duplicada/);
  expect(mapApiErrorToForm({ response:{ data:{ error:'job_not_pending' } } }, setError).toast).toMatch(/pendente/);
  mapApiErrorToForm({ response:{ data:{ error:'validation', field:'f' } } }, setError);
  expect(setError).toHaveBeenCalledWith('f', expect.any(Object));
});
