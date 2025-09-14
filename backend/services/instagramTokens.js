import { encrypt, decrypt } from './crypto.js';
import { query as rootQuery } from '#db';

const q = (db) => (db && db.query ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p));

export async function getTokenRow(db, accountId, orgId=null){
  const params = orgId ? [orgId, accountId] : [accountId];
  const sql = orgId
    ? `SELECT t.access_token, t.enc_ver, t.scopes, t.expiry
         FROM instagram_oauth_tokens t
         JOIN instagram_accounts a ON a.id=t.account_id
        WHERE a.org_id=$1 AND a.id=$2`
    : `SELECT access_token, enc_ver, scopes, expiry FROM instagram_oauth_tokens WHERE account_id=$1`;
  const { rows:[row] = [] } = await q(db)(sql, params);
  if(!row) return null;
  return {
    access_token: decrypt({ c: row.access_token, v: row.enc_ver }),
    scopes: row.scopes || [],
    expiry: row.expiry ? new Date(row.expiry) : null
  };
}

export async function saveTokens(db, accountId, tokens){
  const access = encrypt(tokens.access_token);
  const expiry = tokens.expiry ? new Date(tokens.expiry).toISOString() : null;
  const scopes = tokens.scopes || [];
  await q(db)(
    `INSERT INTO instagram_oauth_tokens (account_id, access_token, enc_ver, scopes, expiry)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (account_id) DO UPDATE
         SET access_token=EXCLUDED.access_token,
             enc_ver=EXCLUDED.enc_ver,
             scopes=EXCLUDED.scopes,
             expiry=EXCLUDED.expiry,
             updated_at=now()`,
    [accountId, access.c, access.v, scopes, expiry]
  );
}

export async function revoke(db, accountId, orgId=null){
  await q(db)('DELETE FROM instagram_oauth_tokens WHERE account_id=$1',[accountId]);
  await q(db)('UPDATE instagram_accounts SET is_active=false, updated_at=now() WHERE id=$1' + (orgId?' AND org_id=$2':''), orgId?[accountId,orgId]:[accountId]);
}

export function needsRefresh(tok){
  return tok.expiry && tok.expiry.getTime() <= Date.now() + 5*60*1000;
}

export async function refreshIfNeeded(db, accountId, orgId=null){
  let tok = await getTokenRow(db, accountId, orgId);
  if(!tok) return null;
  if(!needsRefresh(tok)) return tok;
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.IG_APP_ID,
    client_secret: process.env.IG_APP_SECRET,
    fb_exchange_token: tok.access_token,
  });
  const r = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${params.toString()}`);
  if(!r.ok) return tok;
  const data = await r.json();
  tok = {
    access_token: data.access_token,
    scopes: tok.scopes,
    expiry: data.expires_in ? new Date(Date.now()+data.expires_in*1000) : null,
  };
  await saveTokens(db, accountId, tok);
  return tok;
}

export default { getTokenRow, saveTokens, revoke, needsRefresh, refreshIfNeeded };
