import { query as rootQuery } from '#db';
import { encrypt, decrypt } from './crypto.js';

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

export async function upsertChannel(db, { org_id, type, mode, credentials = null, status = 'disconnected', webhook_secret = null }) {
  if (type === 'instagram' && credentials) {
    console.log('[channels] encrypting Instagram credentials for org', org_id);
  }
  const enc = credentials ? encrypt(JSON.stringify(credentials)) : null;
  const sql = `
    INSERT INTO channels (id, org_id, type, mode, status, credentials_json, webhook_secret, created_at, updated_at)
    VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5::jsonb, $6, now(), now())
    ON CONFLICT (org_id, type)
    DO UPDATE SET mode = EXCLUDED.mode, status = EXCLUDED.status, credentials_json = EXCLUDED.credentials_json, webhook_secret = EXCLUDED.webhook_secret, updated_at = now()
    RETURNING *
  `;
  const params = [org_id, type, mode, status, enc, webhook_secret];
  const { rows } = await q(db)(sql, params);
  const row = rows[0];
  if (row && row.credentials_json) {
    row.credentials = JSON.parse(decrypt(row.credentials_json));
    delete row.credentials_json;
  }
  return row;
}

export async function getChannel(db, org_id, type) {
  const { rows } = await q(db)('SELECT * FROM channels WHERE org_id = $1 AND type = $2', [org_id, type]);
  const row = rows[0];
  if (!row) return null;
  if (row.credentials_json) {
    row.credentials = JSON.parse(decrypt(row.credentials_json));
    delete row.credentials_json;
  }
  return row;
}

export async function setStatus(db, org_id, type, status) {
  const { rows } = await q(db)(
    'UPDATE channels SET status = $3, updated_at = now() WHERE org_id = $1 AND type = $2 RETURNING *',
    [org_id, type, status]
  );
  return rows[0];
}

export default { upsertChannel, getChannel, setStatus };
