// backend/services/baileysService.js
import db from '#db';

export async function startForOrg(orgId, phone) {
  await db.query(
    `UPDATE organizations
       SET whatsapp_baileys_enabled = true,
           whatsapp_baileys_status  = 'pending',
           whatsapp_baileys_phone   = $2
     WHERE id = $1`, [orgId, phone]
  );
  // simulando conexão bem-sucedida
  await db.query(
    `UPDATE organizations
       SET whatsapp_baileys_status = 'connected',
           whatsapp_baileys_session_id = COALESCE(whatsapp_baileys_session_id, gen_random_uuid()::text)
     WHERE id = $1`, [orgId]
  );
}

export async function stopForOrg(orgId) {
  await db.query(
    `UPDATE organizations
       SET whatsapp_baileys_enabled = false,
           whatsapp_baileys_status  = 'disabled'
     WHERE id = $1`, [orgId]
  );
}
