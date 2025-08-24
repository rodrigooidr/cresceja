
import { query } from '../config/db.js';

export async function findOrCreateLeadByChannel({ channel_type, external_from, name=null, phone=null, email=null }){
  // Try by phone/email; else create with consent=false (to be collected)
  if (email){
    const r = await query('SELECT * FROM leads WHERE email=$1 LIMIT 1',[email]);
    if (r.rowCount) return r.rows[0];
  }
  if (phone){
    const r = await query('SELECT * FROM leads WHERE phone=$1 LIMIT 1',[phone]);
    if (r.rowCount) return r.rows[0];
  }
  // by channel external ID (store in a separate table mapping)
  const m = await query('SELECT lead_id FROM channel_id_map WHERE channel_type=$1 AND external_id=$2 LIMIT 1',[channel_type, external_from]);
  if (m.rowCount){
    const l = await query('SELECT * FROM leads WHERE id=$1',[m.rows[0].lead_id]);
    return l.rows[0];
  }
  const ins = await query(
    `INSERT INTO leads (name, email, phone, source_channel, consent, status)
     VALUES ($1,$2,$3,$4,false,'novo') RETURNING *`,
    [name || 'Contato', email, phone, channel_type]
  );
  await query(`INSERT INTO channel_id_map (lead_id, channel_type, external_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [ins.rows[0].id, channel_type, external_from]);
  return ins.rows[0];
}

export async function appendMessage({ channel_type, external_from, text, type='text', attachments=null, ts=null }){
  const lead = await findOrCreateLeadByChannel({ channel_type, external_from });
  // ensure a conversation open
  const conv = await query(
    `INSERT INTO conversations (lead_id, channel_type, status) 
     VALUES ($1,$2,'open')
     ON CONFLICT (lead_id, channel_type) DO NOTHING
     RETURNING *`,
    [lead.id, channel_type]
  );
  const convId = conv.rowCount ? conv.rows[0].id :
    (await query('SELECT id FROM conversations WHERE lead_id=$1 AND channel_type=$2 LIMIT 1',[lead.id, channel_type])).rows[0].id;

  const msg = await query(
    `INSERT INTO messages (conversation_id, lead_id, direction, type, text, attachments, created_at) 
     VALUES ($1,$2,'inbound',$3,$4,$5, to_timestamp($6)) RETURNING *`,
    [convId, lead.id, type, text, attachments, ts ? Number(ts)/1000 : Date.now()/1000]
  );
  return { lead, conversation_id: convId, message: msg.rows[0] };
}
