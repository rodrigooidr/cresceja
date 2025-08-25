// backend/services/contactsService.js
import { query } from '../config/db.js';

export async function getContact(orgId, id) {
  const { rows } = await query('SELECT * FROM contacts WHERE org_id = $1 AND id = $2', [orgId, id]);
  return rows[0];
}

export async function upsertContact(orgId, { id, name, cpf, phone_e164, email, photo_url, tags = [] }) {
  if (id) {
    const { rows } = await query(
      `UPDATE contacts SET name=$3, cpf=$4, phone_e164=$5, email=$6, photo_url=$7, tags=$8, updated_at=now()
       WHERE org_id=$1 AND id=$2 RETURNING *`, [orgId, id, name, cpf, phone_e164, email, photo_url, tags]
    );
    return rows[0];
  }
  const { rows } = await query(
    `INSERT INTO contacts (org_id, name, cpf, phone_e164, email, photo_url, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [orgId, name, cpf, phone_e164, email, photo_url, tags]
  );
  return rows[0];
}
