import { DateTime } from 'luxon';
import { createDropHandler } from '../src/pages/marketing/ContentCalendar.jsx';

describe('ContentCalendar DnD', () => {
  const patch = jest.fn();
  const toast = jest.fn();
  const refetch = jest.fn();

  beforeEach(() => {
    patch.mockReset();
    toast.mockReset();
    refetch.mockReset();
  });

  test('formats date/time to Sao Paulo and patches', async () => {
    patch.mockResolvedValue({});
    const handler = createDropHandler({ patch }, 'org1', toast, refetch);
    const start = DateTime.fromISO('2024-05-01T12:00:00Z').toJSDate();
    await handler({ event: { id: 's1' }, start });
    expect(patch).toHaveBeenCalledWith('/orgs/org1/suggestions/s1', {
      date: '2024-05-01',
      time: '09:00:00-03:00'
    });
    expect(toast).toHaveBeenCalledWith({ title: 'Sugestão reagendada' });
    expect(refetch).toHaveBeenCalled();
  });

  test('handles job_locked error', async () => {
    patch.mockRejectedValueOnce({ response: { data: { error: 'job_locked' } } });
    const handler = createDropHandler({ patch }, 'org1', toast, refetch);
    await handler({ event: { id: 's1' }, start: new Date() });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/não é possível mover/i) }));
  });
});
