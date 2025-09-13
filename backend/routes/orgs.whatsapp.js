import { Router } from 'express';
import { requireFeature } from '../middleware/requireFeature.js';

const router = Router();

// POST /api/orgs/:id/whatsapp/channels
router.post('/api/orgs/:id/whatsapp/channels', requireFeature('whatsapp_numbers'), async (req, res) => {
  const orgId = req.params.id;
  const { provider, phone_e164, display_name } = req.body || {};
  try {
    if (!provider || !phone_e164) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    // XOR: block if other provider active on same phone
    const opposite = provider === 'baileys' ? 'api' : 'baileys';
    const { rows: conflictRows } = await req.db.query(
      `SELECT id FROM whatsapp_channels WHERE org_id=$1 AND phone_e164=$2 AND provider=$3 AND is_active=true`,
      [orgId, phone_e164, opposite]
    );
    if (conflictRows[0]) {
      return res.status(409).json({ error: 'exclusive_mode' });
    }
    const { rows } = await req.db.query(
      `INSERT INTO whatsapp_channels (org_id, provider, phone_e164, display_name)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [orgId, provider, phone_e164, display_name || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'channel_create_failed' });
  }
});

// PUT /api/orgs/:id/whatsapp/channels/:channelId/activate
router.put('/api/orgs/:id/whatsapp/channels/:channelId/activate', async (req, res) => {
  const orgId = req.params.id;
  const { channelId } = req.params;
  try {
    const { rows: [ch] } = await req.db.query(
      'SELECT * FROM whatsapp_channels WHERE id=$1 AND org_id=$2',
      [channelId, orgId]
    );
    if (!ch) return res.status(404).json({ error: 'not_found' });
    const { rows: conflict } = await req.db.query(
      `SELECT id FROM whatsapp_channels WHERE org_id=$1 AND phone_e164=$2 AND provider<>$3 AND is_active=true`,
      [orgId, ch.phone_e164, ch.provider]
    );
    if (conflict[0]) {
      return res.status(409).json({ error: 'exclusive_mode' });
    }
    await req.db.query('UPDATE whatsapp_channels SET is_active=true WHERE id=$1', [channelId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'channel_activate_failed' });
  }
});

export default router;
