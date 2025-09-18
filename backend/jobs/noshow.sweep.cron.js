import cron from 'node-cron';
import { sweepNoShow } from '../services/calendar/noshow.js';
import { auditLog } from '../services/audit.js';

export function startNoShowCron({ db, orgIdResolver }) {
  const spec = process.env.NOSHOW_SWEEP_CRON;
  if (!spec) return null;

  const task = cron.schedule(
    spec,
    async () => {
      const grace = parseInt(process.env.NOSHOW_GRACE_MINUTES || '15', 10);
      const ids = await sweepNoShow({ db, graceMinutes: grace });
      const orgId = (await orgIdResolver?.()) ?? 'global';
      await auditLog(db, {
        orgId,
        userId: null,
        action: 'calendar.no_show.sweep',
        entity: 'calendar_event',
        entityId: null,
        payload: { count: ids.length, ids, cron: true },
      });
    },
    { scheduled: true }
  );

  return task;
}

export default { startNoShowCron };
