
import { query } from '../config/db.js';

export async function audit({ user_id, company_id, action, resource, channel, metadata }){
  await query(
    `INSERT INTO audit_logs (user_id, company_id, action, resource, channel, metadata) 
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user_id, company_id, action, resource, channel, metadata || {}]
  );
}
