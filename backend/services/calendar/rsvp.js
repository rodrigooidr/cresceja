import { randomBytes } from 'node:crypto';
import { query } from '#db';

function token() {
  return randomBytes(16).toString('hex');
}

export async function ensureToken(eventId) {
  if (!eventId) return null;
  const current = await query(
    'SELECT rsvp_token FROM public.calendar_events WHERE id = $1',
    [eventId]
  );
  const existing = current.rows?.[0]?.rsvp_token || null;
  if (existing) return existing;
  const tk = token();
  await query('UPDATE public.calendar_events SET rsvp_token = $2 WHERE id = $1', [eventId, tk]);
  return tk;
}

export async function markRSVPByToken(tk, status) {
  if (!tk || !status) return null;
  const columnMap = {
    confirmed: 'confirmed_at',
    canceled: 'canceled_at',
    noshow: 'noshow_at',
  };
  const column = columnMap[status] || null;
  const assignments = ['rsvp_status = $2'];
  if (column) {
    assignments.push(`${column} = NOW()`);
  }
  const text = `
    UPDATE public.calendar_events
       SET ${assignments.join(', ')}
     WHERE rsvp_token = $1
     RETURNING id, contact_id, org_id
  `;
  const result = await query(text, [tk, status]);
  return result.rows?.[0] || null;
}

export default {
  ensureToken,
  markRSVPByToken,
};
