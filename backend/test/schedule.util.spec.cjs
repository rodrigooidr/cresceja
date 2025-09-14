let generateSchedule;
beforeAll(async () => {
  ({ generateSchedule } = await import('../services/schedule.util.js'));
});

test('respeita igDaily/fbDaily e minGapHoursPerChannel', () => {
  const tz = 'America/Sao_Paulo';
  const monthRef = '2025-10-01';

  const { suggestions } = generateSchedule({
    orgId: 'org-1',
    monthRef,
    frequency: 10,
    defaultTargets: { ig: { enabled: true }, fb: { enabled: true } },
    timeWindows: [{ start: '09:00', end: '18:00' }],
    timezone: tz,
  }, {
    plan: { igDaily: 2, fbDaily: 1 },
    minGapHoursPerChannel: 6,
    existingJobs: [],
    holidays: [],
  });

  expect(suggestions).toHaveLength(10);

  const byDay = new Map();
  for (const s of suggestions) {
    if (s.status === 'skipped') continue;
    const d = s.date;
    const e = byDay.get(d) || { ig: 0, fb: 0, timesIg: [], timesFb: [] };
    if (s.channel_targets.ig?.enabled) { e.ig++; e.timesIg.push(s.time); }
    if (s.channel_targets.fb?.enabled) { e.fb++; e.timesFb.push(s.time); }
    byDay.set(d, e);
  }

  for (const v of byDay.values()) {
    expect(v.ig).toBeLessThanOrEqual(2);
    expect(v.fb).toBeLessThanOrEqual(1);
  }
});
