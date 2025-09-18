/* eslint-env jest */

describe('no-show cron service', () => {
  let sweepNoShow;
  let db;
  let resetDb;

  beforeAll(async () => {
    ({ sweepNoShow } = await import('../services/calendar/noshow.js'));
    ({ db, resetDb } = require('./test.helpers'));
  });

  beforeEach(() => {
    resetDb();
  });

  it('executa 2x sem duplicar status', async () => {
    const first = await sweepNoShow({ db, graceMinutes: 0 });
    const second = await sweepNoShow({ db, graceMinutes: 0 });
    expect(Array.isArray(first)).toBe(true);
    expect(second.length).toBe(0);
  });
});
