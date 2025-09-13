import { google } from 'googleapis';
import { encrypt, decrypt } from '../crypto.js';
import { query as rootQuery } from '#db';

const q = (db) => (db && db.query ? (t, p) => db.query(t, p) : (t, p) => rootQuery(t, p));

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function loadTokens(db, accountId, orgId = null) {
  const params = orgId ? [orgId, accountId] : [accountId];
  const sql = orgId
    ? `SELECT t.access_token, t.refresh_token, t.expiry, t.scopes
         FROM google_oauth_tokens t
         JOIN google_calendar_accounts a ON a.id = t.account_id
        WHERE a.org_id = $1 AND a.id = $2`
    : `SELECT access_token, refresh_token, expiry, scopes
         FROM google_oauth_tokens
        WHERE account_id = $1`;
  const { rows: [row] = [] } = await q(db)(sql, params);
  if (!row) return null;
  return {
    access_token: decrypt(row.access_token),
    refresh_token: decrypt(row.refresh_token),
    expiry: row.expiry ? new Date(row.expiry) : null,
    scopes: row.scopes || [],
  };
}

export async function saveTokens(db, accountId, tokens) {
  const access = encrypt(tokens.access_token);
  const refresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
  const expiry = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : tokens.expiry
    ? new Date(tokens.expiry).toISOString()
    : null;
  const scopes = tokens.scopes || (typeof tokens.scope === 'string' ? tokens.scope.split(' ') : []);
  await q(db)(
    `INSERT INTO google_oauth_tokens (account_id, access_token, refresh_token, expiry, scopes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (account_id) DO UPDATE
          SET access_token=EXCLUDED.access_token,
              refresh_token=EXCLUDED.refresh_token,
              expiry=EXCLUDED.expiry,
              scopes=EXCLUDED.scopes,
              updated_at=now()`,
    [accountId, access, refresh, expiry, scopes]
  );
}

export async function ensureFreshTokens(db, accountId, orgId = null) {
  const tok = await loadTokens(db, accountId, orgId);
  if (!tok) return null;
  const oauth = getOAuthClient();
  oauth.setCredentials({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expiry_date: tok.expiry ? tok.expiry.getTime() : null,
  });
  const needsRefresh = tok.refresh_token && (!tok.expiry || tok.expiry.getTime() <= Date.now() + 5 * 60 * 1000);
  if (needsRefresh) {
    const { credentials } = await oauth.refreshAccessToken();
    await saveTokens(db, accountId, credentials);
    oauth.setCredentials(credentials);
  }
  return oauth;
}

export async function forceRefresh(db, accountId, orgId = null) {
  const tok = await loadTokens(db, accountId, orgId);
  if (!tok || !tok.refresh_token) return null;
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: tok.refresh_token });
  const { credentials } = await oauth.refreshAccessToken();
  await saveTokens(db, accountId, credentials);
  return credentials;
}

export async function revokeTokens(db, accountId, orgId = null) {
  const tok = await loadTokens(db, accountId, orgId);
  if (!tok) return false;
  try {
    await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tok.access_token), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
  } catch {}
  await q(db)('DELETE FROM google_oauth_tokens WHERE account_id=$1', [accountId]);
  await q(db)('UPDATE google_calendar_accounts SET is_active=false WHERE id=$1' + (orgId ? ' AND org_id=$2' : ''), orgId ? [accountId, orgId] : [accountId]);
  return true;
}

export default { getOAuthClient, loadTokens, saveTokens, ensureFreshTokens, forceRefresh, revokeTokens };
