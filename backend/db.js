import { pool } from './config/db.js';

export { pool };

export async function withOrg(tx, orgId) {
  await tx.query('SET LOCAL app.org_id = $1', [orgId]);
}
