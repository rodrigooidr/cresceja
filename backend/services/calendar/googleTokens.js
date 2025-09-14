import { encrypt, decrypt } from '../crypto.js';
import { query as rootQuery } from '#db';

const q = (db) => (db && db.query ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p));

export async function loadTokens(db, accountId, orgId=null){
  const params = orgId ? [orgId, accountId] : [accountId];
  const sql = orgId
    ? `SELECT t.access_token, t.refresh_token, t.expiry, t.scopes
         FROM google_oauth_tokens t
         JOIN google_calendar_accounts a ON a.id = t.account_id
        WHERE a.org_id = $1 AND a.id = $2`
    : `SELECT access_token, refresh_token, expiry, scopes
         FROM google_oauth_tokens WHERE account_id = $1`;
  const { rows:[row] = [] } = await q(db)(sql, params);
  if(!row) return null;
  return {
    access_token: decrypt({ c: row.access_token }),
    refresh_token: row.refresh_token ? decrypt({ c: row.refresh_token }) : null,
    expiry: row.expiry ? new Date(row.expiry) : null,
    scopes: row.scopes || []
  };
}

export async function saveTokens(db, accountId, tokens){
  const access = encrypt(tokens.access_token);
  const refresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
  const expiry = tokens.expiry
    ? new Date(tokens.expiry).toISOString()
    : tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
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
    [accountId, access.c, refresh ? refresh.c : null, expiry, scopes]
  );
}

export function needsRefresh(tok){
  if(!tok.refresh_token) return false;
  if(!tok.expiry) return true;
  return tok.expiry.getTime() <= Date.now() + 5*60*1000;
}

async function refresh(db, tok, accountId){
  if(!tok.refresh_token) return tok;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: tok.refresh_token,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if(!res.ok) throw new Error('refresh_failed');
  const data = await res.json();
  const newTok = {
    access_token: data.access_token,
    refresh_token: tok.refresh_token,
    expiry: data.expires_in ? new Date(Date.now()+data.expires_in*1000) : null,
    scopes: tok.scopes,
  };
  await saveTokens(db, accountId, newTok);
  return newTok;
}

export async function refreshIfNeeded(db, accountId, orgId=null){
  let tok = await loadTokens(db, accountId, orgId);
  if(!tok) return null;
  if(needsRefresh(tok)){
    tok = await refresh(db, tok, accountId);
  }
  return tok;
}

export async function forceRefresh(db, accountId, orgId=null){
  const tok = await loadTokens(db, accountId, orgId);
  if(!tok) return null;
  return refresh(db, tok, accountId);
}

export async function revokeTokens(db, accountId, orgId=null){
  const tok = await loadTokens(db, accountId, orgId);
  if(!tok) return false;
  try{
    await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tok.access_token), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
  }catch{}
  await q(db)('DELETE FROM google_oauth_tokens WHERE account_id=$1', [accountId]);
  await q(db)('UPDATE google_calendar_accounts SET is_active=false, updated_at=now() WHERE id=$1' + (orgId ? ' AND org_id=$2' : ''), orgId ? [accountId, orgId] : [accountId]);
  return true;
}

export default { loadTokens, saveTokens, refreshIfNeeded, forceRefresh, revokeTokens };
