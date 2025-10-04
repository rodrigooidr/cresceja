import { mapApiErrorToForm } from '../src/ui/errors/mapApiError.js';

test('maps facebook related errors', () => {
  const setError = jest.fn();
  expect(mapApiErrorToForm({ response:{ data:{ error:'fb_quota_reached' } } }, setError).toast).toMatch(/Facebook/);
  expect(mapApiErrorToForm({ response:{ data:{ error:'feature_limit_reached' } } }, setError).toast).toMatch(/Limite do plano/);
  mapApiErrorToForm({ response:{ data:{ error:'validation', field:'msg' } } }, setError);
  expect(setError).toHaveBeenCalledWith('msg', expect.any(Object));
});
