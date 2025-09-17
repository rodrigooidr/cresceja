import { google } from 'googleapis';
import { query } from '#db';
import { getOrgCalendarConfig } from './config.js';
import { nextSlots } from './slots.js';

const DEFAULT_TZ = process.env.CALENDAR_TIMEZONE || 'America/Sao_Paulo';
const DEFAULT_LEAD = Number(process.env.CALENDAR_LEAD_TIME_MIN || 120);
const DEFAULT_SLOT = Number(process.env.CALENDAR_SLOT_DEFAULT_MIN || 30);
const DEFAULT_PRE = Number(process.env.CALENDAR_PRE_BUFFER_MIN || 0);
const DEFAULT_POST = Number(process.env.CALENDAR_POST_BUFFER_MIN || 0);

function notConfigured() {
  const err = new Error('calendar_not_configured');
  err.status = 501;
  return err;
}

function parseCredentials(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && parsed.client_id && parsed.client_secret && parsed.refresh_token) {
      return parsed;
    }
  } catch (err) {
    /* noop */
  }
  return null;
}

async function getOAuth(orgId, calendarId) {
  const res = await query(
    `
      SELECT access_token_enc
        FROM public.channel_accounts
       WHERE org_id = $1
         AND channel = 'google_calendar'
         AND (username = $2 OR external_account_id = $2)
       LIMIT 1
    `,
    [orgId, calendarId]
  );

  const creds = parseCredentials(res.rows[0]?.access_token_enc);
  if (!creds) throw notConfigured();

  const oauth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  oauth.setCredentials({ refresh_token: creds.refresh_token });
  return oauth;
}

function normalizeName(input) {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchPerson(cfg, rawNameOrAlias, skill = null) {
  const needle = normalizeName(rawNameOrAlias);
  const people = cfg.people || [];

  let match = people.find((person) => normalizeName(person.name) === needle);
  if (!match && needle) {
    match = people.find((person) =>
      (person.aliases || []).some((alias) => normalizeName(alias) === needle)
    );
  }
  if (!match && skill) {
    match = people.find((person) =>
      (person.skills || []).some((item) => normalizeName(item) === normalizeName(skill))
    );
  }
  return match || null;
}

async function listCalendars(orgId) {
  if (!orgId) return { items: [] };
  const cfg = await getOrgCalendarConfig(orgId);
  return cfg.people.map((person) => ({
    name: person.name,
    calendars: person.calendars,
    aliases: person.aliases,
    skills: person.skills,
    slotMin: person.slotMin || null,
  }));
}

async function fetchBusyBlocks(orgId, calendarId, fromISO, toISO) {
  try {
    const auth = await getOAuth(orgId, calendarId);
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: fromISO,
        timeMax: toISO,
        items: [{ id: calendarId }],
      },
    });
    return response.data?.calendars?.[calendarId]?.busy || [];
  } catch (err) {
    return [];
  }
}

async function getAvailability({
  orgId,
  personName = null,
  skill = null,
  from,
  to,
  durationMin = DEFAULT_SLOT,
  leadMin = DEFAULT_LEAD,
  tz = DEFAULT_TZ,
}) {
  if (!orgId) throw notConfigured();
  if (!from || !to) {
    const err = new Error('from_to_required');
    err.status = 400;
    throw err;
  }

  const cfg = await getOrgCalendarConfig(orgId);
  const target = matchPerson(cfg, personName, skill);
  const people = target ? [target] : cfg.people;

  const result = {};
  const lead = leadMin ?? DEFAULT_LEAD;

  for (const person of people) {
    const busy = [];
    for (const calendarId of person.calendars || []) {
      const blocks = await fetchBusyBlocks(orgId, calendarId, from, to);
      busy.push(...blocks);
    }

    const preBuf = person.buffers?.pre ?? DEFAULT_PRE;
    const postBuf = person.buffers?.post ?? DEFAULT_POST;

    const busyWithBuffers = busy.map((item) => {
      const start = item.start || item.startTime || item.start_at;
      const end = item.end || item.endTime || item.end_at;
      if (!start || !end) return null;
      return {
        start: new Date(new Date(start).getTime() - preBuf * 60 * 1000).toISOString(),
        end: new Date(new Date(end).getTime() + postBuf * 60 * 1000).toISOString(),
      };
    }).filter(Boolean);

    result[person.name] = {
      busy: busyWithBuffers,
      slotMin: person.slotMin || durationMin,
      buffers: { pre: preBuf, post: postBuf },
    };
  }

  return {
    range: { from, to },
    byPerson: result,
    rules: {
      tz,
      leadMin: lead,
      businessHours: cfg.business_hours || null,
      defaultDuration: durationMin,
    },
  };
}

async function suggest({
  orgId,
  personName = null,
  skill = null,
  fromISO,
  durationMin = DEFAULT_SLOT,
  count = Number(process.env.CALENDAR_SUGGESTION_COUNT || 3),
  tz = DEFAULT_TZ,
  leadMin = DEFAULT_LEAD,
}) {
  if (!fromISO) {
    const err = new Error('fromISO_required');
    err.status = 400;
    throw err;
  }

  const cfg = await getOrgCalendarConfig(orgId);
  const target = matchPerson(cfg, personName, skill);
  const people = target ? [target] : cfg.people;

  const windowEnd = new Date(new Date(fromISO).getTime() + 8 * 60 * 60 * 1000).toISOString();

  const suggestions = {};

  for (const person of people) {
    const busy = [];
    for (const calendarId of person.calendars || []) {
      const blocks = await fetchBusyBlocks(orgId, calendarId, fromISO, windowEnd);
      busy.push(...blocks);
    }

    const preBuf = person.buffers?.pre ?? DEFAULT_PRE;
    const postBuf = person.buffers?.post ?? DEFAULT_POST;

    const busyWithBuffers = busy
      .map((item) => {
        if (!item?.start || !item?.end) return null;
        return {
          start: new Date(new Date(item.start).getTime() - preBuf * 60 * 1000).toISOString(),
          end: new Date(new Date(item.end).getTime() + postBuf * 60 * 1000).toISOString(),
        };
      })
      .filter(Boolean);

    const slots = nextSlots({
      fromISO,
      durationMin: person.slotMin || durationMin,
      count,
      busy: busyWithBuffers,
      leadMin,
      bh: cfg.business_hours || null,
      tz,
    });

    suggestions[person.name] = slots;
  }

  return suggestions;
}

function ensurePerson(cfg, personName, skill) {
  const person = matchPerson(cfg, personName, skill);
  if (!person) {
    const err = new Error('person_not_found');
    err.status = 404;
    throw err;
  }
  return person;
}

async function createEvent({
  orgId,
  personName,
  skill = null,
  summary,
  description,
  startISO,
  endISO,
  attendeeEmail,
  attendeeName,
  idem,
  tz = DEFAULT_TZ,
  contactId = null,
}) {
  if (!orgId) throw notConfigured();
  if (!startISO || !endISO) {
    const err = new Error('start_end_required');
    err.status = 400;
    throw err;
  }

  const cfg = await getOrgCalendarConfig(orgId);
  const person = ensurePerson(cfg, personName, skill);

  for (const calendarId of person.calendars || []) {
    const auth = await getOAuth(orgId, calendarId);
    const calendar = google.calendar({ version: 'v3', auth });

    if (idem) {
      const existing = await calendar.events.list({
        calendarId,
        privateExtendedProperty: `idem=${idem}`,
        timeMin: startISO,
        timeMax: endISO,
        maxResults: 1,
        singleEvents: true,
      });
      const prior = existing.data?.items?.[0];
      if (prior) {
        return normalize(prior);
      }
    }

    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: startISO,
        timeMax: endISO,
        items: [{ id: calendarId }],
      },
    });
    const busy = fb.data?.calendars?.[calendarId]?.busy || [];
    if (busy.length) {
      const err = new Error('time_conflict');
      err.status = 409;
      throw err;
    }
  }

  const calendarId = person.calendars?.[0];
  if (!calendarId) throw notConfigured();

  const auth = await getOAuth(orgId, calendarId);
  const calendar = google.calendar({ version: 'v3', auth });

  const inserted = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: summary || 'Atendimento',
      description,
      start: { dateTime: startISO, timeZone: tz },
      end: { dateTime: endISO, timeZone: tz },
      attendees: attendeeEmail
        ? [
            {
              email: attendeeEmail,
              displayName: attendeeName || undefined,
            },
          ]
        : [],
      extendedProperties: {
        shared: idem ? { idem } : {},
      },
    },
  });

  const event = normalize(inserted.data);

  await query(
    `
      INSERT INTO public.calendar_events (
        org_id,
        calendar_id,
        type,
        title,
        description,
        start_at,
        end_at,
        attendee_id,
        provider,
        external_event_id,
        contact_id,
        reminder_sent,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        NULL,
        'meeting',
        $2,
        $3,
        $4::timestamptz,
        $5::timestamptz,
        NULL,
        'google',
        $6,
        $7,
        COALESCE($8, FALSE),
        now(),
        now()
      )
      ON CONFLICT (external_event_id) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            updated_at = now(),
            contact_id = COALESCE(EXCLUDED.contact_id, public.calendar_events.contact_id)
    `,
    [
      orgId,
      event.summary,
      description || null,
      event.start,
      event.end,
      event.id,
      contactId,
      null,
    ]
  ).catch(() => {});

  return event;
}

async function updateEvent({ orgId, id, calendarId, summary, description, startISO, endISO, tz = DEFAULT_TZ }) {
  if (!orgId) throw notConfigured();
  if (!id || !calendarId) {
    const err = new Error('event_and_calendar_required');
    err.status = 400;
    throw err;
  }

  const auth = await getOAuth(orgId, calendarId);
  const calendar = google.calendar({ version: 'v3', auth });

  const current = await calendar.events.get({ calendarId, eventId: id });
  const body = current.data || {};

  if (summary) body.summary = summary;
  if (description !== undefined) body.description = description;
  if (startISO) body.start = { dateTime: startISO, timeZone: tz };
  if (endISO) body.end = { dateTime: endISO, timeZone: tz };

  const updated = await calendar.events.update({
    calendarId,
    eventId: id,
    requestBody: body,
  });

  const event = normalize(updated.data);

  await query(
    `
      UPDATE public.calendar_events
         SET title = COALESCE($3, title),
             description = COALESCE($4, description),
             start_at = COALESCE($5::timestamptz, start_at),
             end_at = COALESCE($6::timestamptz, end_at),
             updated_at = now()
       WHERE org_id = $1
         AND external_event_id = $2
    `,
    [orgId, id, summary || null, description || null, event.start, event.end]
  ).catch(() => {});

  return event;
}

async function deleteEvent({ orgId, id, calendarId }) {
  if (!orgId) throw notConfigured();
  if (!id || !calendarId) {
    const err = new Error('event_and_calendar_required');
    err.status = 400;
    throw err;
  }

  const auth = await getOAuth(orgId, calendarId);
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId, eventId: id });

  await query(
    `DELETE FROM public.calendar_events WHERE org_id = $1 AND external_event_id = $2`,
    [orgId, id]
  ).catch(() => {});

  return true;
}

function normalize(event) {
  return {
    id: event.id,
    summary: event.summary || null,
    description: event.description || null,
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    attendees: event.attendees || [],
    htmlLink: event.htmlLink || null,
    calendarId: event.organizer?.email || null,
  };
}

export {
  listCalendars,
  getAvailability,
  suggest,
  createEvent,
  updateEvent,
  deleteEvent,
};

export default {
  listCalendars,
  getAvailability,
  suggest,
  createEvent,
  updateEvent,
  deleteEvent,
};
