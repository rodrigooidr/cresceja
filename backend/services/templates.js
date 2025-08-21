import { pool } from '../config/db.js';

export async function compileTemplate(orgId, templateId, vars = {}) {
  const { rows } = await pool.query(
    `SELECT subject, body FROM message_templates WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid`,
    [templateId]
  );
  if (!rows[0]) throw new Error('template_not_found');
  let body = rows[0].body;
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{{${k}}}`, String(v ?? ''));
  }
  return { subject: rows[0].subject, body };
}
