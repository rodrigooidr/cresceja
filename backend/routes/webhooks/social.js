import express from 'express';
import { pool } from '../../config/db.js';

const router = express.Router();

router.post('/:provider', async (req, res) => {
  const provider = req.params.provider;
  const orgId = req.body?.org_id || req.query.org_id;
  if (!orgId) return res.status(400).json({ error: 'org_required' });
  const message = req.body?.message || 'stub';
  const contact = req.body?.from || 'unknown';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL app.org_id = $1', [orgId]);
    const { rows: contactRows } = await client.query(
      `INSERT INTO contacts (org_id, name, phone) VALUES ($1,$2,$3) RETURNING id`,
      [orgId, contact, contact]
    );
    const contactId = contactRows[0].id;
    const { rows: convRows } = await client.query(
      `INSERT INTO conversations (org_id, channel_id, contact_id)
       VALUES ($1,$2,$3) RETURNING id`,
      [orgId, req.body?.channel_id || null, contactId]
    );
    const convId = convRows[0].id;
    await client.query(
      `INSERT INTO messages (org_id, conversation_id, sender, content)
       VALUES ($1,$2,'contact',$3)`,
      [orgId, convId, message]
    );
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('webhook error', e);
  } finally {
    client.release();
  }
  res.json({ data: { received: true, provider } });
});

export default router;
