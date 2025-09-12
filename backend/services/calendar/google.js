// backend/services/calendar/google.js
import { google } from 'googleapis';
import { query } from '#db';

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return oauth2Client;
}

export async function saveTokens(userId, tokens) {
  await query(
    `INSERT INTO calendar_integrations (user_id, provider, tokens)
     VALUES ($1,'google',$2::jsonb)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET tokens=$2::jsonb, updated_at=NOW()`,
    [userId, JSON.stringify(tokens)]
  );
}

export async function getTokens(userId) {
  const r = await query(
    "SELECT tokens FROM calendar_integrations WHERE user_id=$1 AND provider='google'",
    [userId]
  );
  const t = r.rows[0]?.tokens ?? null;
  return (t && typeof t === 'string') ? JSON.parse(t) : t;
}

export async function createEvent(userId, { summary, start, end }) {
  const tokens = await getTokens(userId);
  if (!tokens) return { ok: false, error: 'not_connected' };

  const oauth = getOAuthClient();
  oauth.setCredentials(tokens);

  const cal = google.calendar({ version: 'v3', auth: oauth });

  const timeMin = new Date(start).toISOString();
  const timeMax = new Date(end).toISOString();

  // checar conflito
  const { data } = await cal.freebusy.query({
    requestBody: { timeMin, timeMax, items: [{ id: 'primary' }] }
  });
  const busy = data?.calendars?.primary?.busy || [];
  if (busy.length) return { ok: false, error: 'conflict', busy };

  // criar evento
  await cal.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      start: { dateTime: timeMin },
      end: { dateTime: timeMax }
    }
  });

  return { ok: true };
}

export function getAuthUrl(state) {
  const oauth = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  return oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state
  });
}

export async function handleCallback(code, userId) {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  await saveTokens(userId, tokens);
  return { ok: true };
}

export default { getAuthUrl, handleCallback, createEvent, saveTokens, getTokens };
