const { encrypt, decrypt } = require('./crypto.util.cjs');

const TOK_URL = 'https://oauth2.googleapis.com/token';
const REV_URL = 'https://oauth2.googleapis.com/revoke';

async function getTokenRow(db, accountId) {
  const { rows } = await db.query(
    `SELECT id, access_token, refresh_token, expiry, scopes, enc_ver
       FROM google_oauth_tokens WHERE account_id=$1`, [accountId]);
  return rows[0] || null;
}

function unpack(row) {
  if (!row) return null;
  const access_token  = decrypt({ c: row.access_token,  v: row.enc_ver });
  const refresh_token = row.refresh_token ? decrypt({ c: row.refresh_token, v: row.enc_ver }) : null;
  return { ...row, access_token, refresh_token };
}

async function saveTokens(db, accountId, { access_token, refresh_token, expires_in, scope }) {
  const exp = new Date(Date.now() + (expires_in || 3600) * 1000);
  const encA = encrypt(access_token);
  const encR = refresh_token ? encrypt(refresh_token) : null;
  await db.query(
    `INSERT INTO google_oauth_tokens (account_id, access_token, refresh_token, expiry, scopes, enc_ver, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (account_id) DO UPDATE
        SET access_token=$2, refresh_token=COALESCE($3, google_oauth_tokens.refresh_token),
            expiry=$4, scopes=$5, enc_ver=$6, updated_at=now()`,
    [accountId, encA.c, encR?.c || null, exp, (scope ? scope.split(' ') : null), encA.v]
  );
  return exp;
}

function needsRefresh(expiry, skewSec=300) {
  if (!expiry) return true;
  return (new Date(expiry).getTime() - Date.now()) <= skewSec*1000;
}

async function refreshIfNeeded(db, accountId, clientId, clientSecret) {
  const row = unpack(await getTokenRow(db, accountId));
  if (!row) throw Object.assign(new Error('no_token'), { code: 'no_token' });
  if (!needsRefresh(row.expiry)) return { access_token: row.access_token, expiry: row.expiry };

  if (!row.refresh_token) throw Object.assign(new Error('no_refresh'), { code: 'no_refresh' });

  const resp = await fetch(TOK_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    })
  });
  if (!resp.ok) throw Object.assign(new Error('refresh_failed'), { code:'refresh_failed', status:resp.status });
  const data = await resp.json(); // { access_token, expires_in, scope, token_type }
  const expiry = await saveTokens(db, accountId, { access_token: data.access_token, expires_in: data.expires_in, scope: data.scope });
  return { access_token: data.access_token, expiry };
}

async function revoke(db, accountId) {
  const row = unpack(await getTokenRow(db, accountId));
  if (row?.access_token) {
    await fetch(REV_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ token: row.access_token })
    }).catch(()=>{});
  }
  await db.query(`DELETE FROM google_oauth_tokens WHERE account_id=$1`, [accountId]);
}

module.exports = { getTokenRow, saveTokens, refreshIfNeeded, revoke, needsRefresh };
