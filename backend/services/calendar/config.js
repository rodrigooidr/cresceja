import { query } from '#db';

export async function getOrgCalendarConfig(orgId) {
  if (!orgId) {
    return { business_hours: null, people: [] };
  }

  const orgRes = await query(
    `SELECT business_hours FROM public.org_ai_settings WHERE org_id = $1`,
    [orgId]
  );
  const businessHours = orgRes.rows[0]?.business_hours || null;

  const accountsRes = await query(
    `
      SELECT name,
             username AS calendar_id,
             external_account_id,
             COALESCE(permissions_json, '{}'::jsonb) AS perms,
             access_token_enc
        FROM public.channel_accounts
       WHERE org_id = $1
         AND channel = 'google_calendar'
    `,
    [orgId]
  );

  const peopleMap = new Map();

  for (const row of accountsRes.rows) {
    const key = (row.name || row.calendar_id || '').trim();
    if (!key) continue;

    const aliases = Array.isArray(row.perms?.aliases)
      ? row.perms.aliases.map((alias) => String(alias || '').toLowerCase()).filter(Boolean)
      : [];
    const skills = Array.isArray(row.perms?.skills) ? row.perms.skills : [];
    const slotMin = row.perms?.slotMin || null;
    const buffers = row.perms?.buffers || {};

    const existing = peopleMap.get(key) || {
      name: key,
      calendars: [],
      aliases: new Set(),
      skills: new Set(),
      slotMin: null,
      buffers: {},
    };

    const calendarId = row.external_account_id || row.calendar_id;
    if (calendarId) existing.calendars.push(calendarId);

    aliases.forEach((alias) => existing.aliases.add(alias));
    skills.forEach((skill) => existing.skills.add(skill));

    if (slotMin && !existing.slotMin) {
      existing.slotMin = slotMin;
    }

    existing.buffers = {
      pre: buffers?.pre ?? existing.buffers?.pre ?? null,
      post: buffers?.post ?? existing.buffers?.post ?? null,
    };

    peopleMap.set(key, existing);
  }

  const people = Array.from(peopleMap.values()).map((person) => ({
    ...person,
    aliases: Array.from(person.aliases),
    skills: Array.from(person.skills),
  }));

  return {
    business_hours: businessHours,
    people,
  };
}

export default { getOrgCalendarConfig };
