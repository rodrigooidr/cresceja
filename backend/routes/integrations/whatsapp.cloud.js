import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import channels from '../../services/channels.service.js';

const router = Router();
router.use(authRequired, orgScope);

// POST /api/integrations/whatsapp/cloud/connect
router.post('/connect', async (req, res) => {
  const { phone_number_id, waba_id, access_token, verify_token } = req.body || {};
  if (!phone_number_id || !access_token) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    await channels.upsertChannel({
      org_id: req.orgId,
      type: 'whatsapp',
      mode: 'cloud',
      credentials: { phone_number_id, waba_id, access_token, verify_token },
      status: 'connected',
      webhook_secret: verify_token,
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'connect_failed' });
  }
});

// GET /api/integrations/whatsapp/cloud/status
router.get('/status', async (req, res) => {
  const ch = await channels.getChannel(req.orgId, 'whatsapp');
  if (!ch || ch.mode !== 'cloud') {
    return res.json({ status: 'disconnected' });
  }
  const creds = ch.credentials || {};
  const redacted = creds.access_token ? `${creds.access_token.slice(0, 4)}...` : null;
  return res.json({
    status: ch.status,
    phone_number_id: creds.phone_number_id || null,
    waba_id: creds.waba_id || null,
    verify_token: creds.verify_token || null,
    access_token: redacted,
  });
});

// DELETE /api/integrations/whatsapp/cloud/disconnect
router.delete('/disconnect', async (req, res) => {
  try {
    await channels.upsertChannel({
      org_id: req.orgId,
      type: 'whatsapp',
      mode: 'cloud',
      credentials: null,
      status: 'disconnected',
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'disconnect_failed' });
  }
});

export default router;
