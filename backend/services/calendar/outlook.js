import { ConfidentialClientApplication } from '@azure/msal-node';
import { query } from '../../config/db.js';

let msalApp = null;

function hasMsalConfig() {
  const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI } = process.env;
  return !!(AZURE_CLIENT_ID && AZURE_TENANT_ID && AZURE_CLIENT_SECRET && AZURE_REDIRECT_URI);
}

function getTenant() {
  return process.env.AZURE_TENANT_ID;
}

function getMsalApp() {
  if (!hasMsalConfig()) return null;
  if (msalApp) return msalApp;
  msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
  });
  return msalApp;
}

export async function saveTokens(userId, tokens) {
  await query(
    `INSERT INTO calendar_integrations (user_id, provider, tokens)
     VALUES ($1,'outlook',$2::jsonb)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET tokens=$2::jsonb, updated_at=NOW()`,
    [userId, JSON.stringify(tokens)]
  );
}

export async function getTokens(userId) {
  const r = await query(
    "SELECT tokens FROM calendar_integrations WHERE user_id=$1 AND provider='outlook'",
    [userId]
  );
  const t = r.rows[0]?.tokens ?? null;
  return (t && typeof t === 'string') ? JSON.parse(t) : t;
}

export function getAuthUrl(state) {
  if (!hasMsalConfig()) throw new Error('msal_not_configured');
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    response_mode: 'query',
    scope: 'offline_access Calendars.ReadWrite User.Read',
    state,
  });
  return `https://login.microsoftonline.com/${getTenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function handleCallback(code, userId) {
  const app = getMsalApp();
  if (!app) throw new Error('msal_not_configured');

  const tokenRequest = {
    code,
    scopes: ['offline_access', 'Calendars.ReadWrite', 'User.Read'],
    redirectUri: process.env.AZURE_REDIRECT_URI,
  };
  const result = await app.acquireTokenByCode(tokenRequest);

  await saveTokens(userId, {
    accessToken: result.accessToken,
    expiresOn: result.expiresOn,
    account: result.account,
    scope: 'Calendars.ReadWrite offline_access User.Read',
  });

  return { ok: true };
}

export async function createEvent(userId, { subject, start, end }) {
  if (!hasMsalConfig()) return { ok: false, error: 'msal_not_configured' };

  const tokens = await getTokens(userId);
  if (!tokens?.accessToken) return { ok: false, error: 'not_connected' };

  const accessToken = tokens.accessToken;
  const startISO = new Date(start).toISOString();
  const endISO = new Date(end).toISOString();

  // checar conflito
  const resFb = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schedules: ['me'],
      startTime: { dateTime: startISO, timeZone: 'UTC' },
      endTime:   { dateTime: endISO,   timeZone: 'UTC' },
      availabilityViewInterval: 30,
    }),
  });
  const fb = await resFb.json().catch(() => ({}));
  const busy = fb?.value?.[0]?.scheduleItems || [];
  if (busy.length) return { ok: false, error: 'conflict', busy };

  // criar evento
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      start: { dateTime: startISO, timeZone: 'UTC' },
      end:   { dateTime: endISO,   timeZone: 'UTC' },
    }),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    return { ok: false, error: 'create_failed', details };
  }
  return { ok: true };
}

export default { getAuthUrl, handleCallback, createEvent, getTokens, saveTokens };
