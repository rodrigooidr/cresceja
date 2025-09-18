import { query as rootQuery } from '#db';

function getQuery(db) {
  if (db && typeof db.query === 'function') {
    return (text, params) => db.query(text, params);
  }
  return (text, params) => rootQuery(text, params);
}

export async function sweepNoShow({ db, graceMinutes = 15 } = {}) {
  const enabled = String(process.env.NOSHOW_ENABLED || '').toLowerCase();
  if (enabled && enabled !== 'true') {
    return [];
  }

  const minutes = Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15;
  const result = await getQuery(db)(
    `
      UPDATE public.calendar_events
         SET rsvp_status = 'noshow',
             noshow_at = NOW()
       WHERE rsvp_status = 'pending'
         AND start_at < NOW() - make_interval(mins := $1::int)
         AND canceled_at IS NULL
      RETURNING id
    `,
    [minutes]
  );

  return result?.rows?.map((row) => row.id) || [];
}

export default { sweepNoShow };
