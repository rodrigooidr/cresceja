import { query } from '../config/db.js';
import { encrypt, decrypt } from './crypto.js';

export async function upsertChannel({ org_id, type, mode, credentials = null, status = 'disconnected', webhook_secret = null }) {
  const enc = credentials ? encrypt(credentials) : null;
  const sql = `
    INSERT INTO channels (id, org_id, type, mode, status, credentials_json, webhook_secret, created_at, updated_at)
    VALUES (uuid_generate_v4(), $1, $2, $3, $4, to_jsonb($5::text), $6, now(), now())
    ON CONFLICT (org_id, type)
    DO UPDATE SET mode = EXCLUDED.mode, status = EXCLUDED.status, credentials_json = EXCLUDED.credentials_json, webhook_secret = EXCLUDED.webhook_secret, updated_at = now()
    RETURNING *
  `;
  const params = [org_id, type, mode, status, enc, webhook_secret];
  const { rows } = await query(sql, params);
  const row = rows[0];
  if (row && row.credentials_json) {
    row.credentials = decrypt(row.credentials_json);
    delete row.credentials_json;
  }
  return row;
}

export async function getChannel(org_id, type) {
  const { rows } = await query('SELECT * FROM channels WHERE org_id = $1 AND type = $2', [org_id, type]);
  const row = rows[0];
  if (!row) return null;
  if (row.credentials_json) {
    row.credentials = decrypt(row.credentials_json);
    delete row.credentials_json;
  }
  return row;
}

export async function setStatus(org_id, type, status) {
  const { rows } = await query(
    'UPDATE channels SET status = $3, updated_at = now() WHERE org_id = $1 AND type = $2 RETURNING *',
    [org_id, type, status]
  );
  return rows[0];
}

export default { upsertChannel, getChannel, setStatus };
