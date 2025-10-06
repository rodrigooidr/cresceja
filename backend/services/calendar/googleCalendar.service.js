import { google } from 'googleapis';

// carrega auth e tokens do DB (TODO)
export async function getAuthForProfessional(professionalId) {
  /* ... */
  return null;
}

export async function freeBusy({ professionalId, timeMin, timeMax }) {
  const auth = await getAuthForProfessional(professionalId);
  if (!auth) return { busy: [] }; // fallback sem Google
  const calendar = google.calendar({ version: 'v3', auth });
  const fb = await calendar.freebusy.query({
    requestBody: { timeMin, timeMax, items: [{ id: 'primary' }] }
  });
  const busy = fb.data.calendars?.primary?.busy || [];
  return { busy };
}

export async function createEvent({ professionalId, summary, description, start, end, attendees = [], location, extendedPrivate }) {
  const auth = await getAuthForProfessional(professionalId);
  if (!auth) {
    // fallback local (retorne apenas estrutura)
    return { id: null, google_event_id: null, created_local: true };
  }
  const calendar = google.calendar({ version: 'v3', auth });
  const resp = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary, description,
      start: { dateTime: start.dateTime, timeZone: start.timeZone },
      end:   { dateTime: end.dateTime,   timeZone: end.timeZone },
      attendees,
      location,
      reminders: { useDefault: true },
      extendedProperties: { private: extendedPrivate }
    }
  });
  return { id: resp.data.id, google_event_id: resp.data.id, created_local: false };
}
