import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import channels from '../../services/channels.service.js';
import waSession from '../../services/wa.session.js';

const router = Router();
router.use(authRequired, orgScope);

// POST /api/integrations/whatsapp/session/start
router.post('/start', async (req, res) => {
  await channels.upsertChannel({
    org_id: req.orgId,
    type: 'whatsapp',
    mode: 'session',
    status: 'connecting',
  });
  const io = req.app.get('io');
  await waSession.start(req.orgId, io);
  res.json({ status: 'connecting' });
});

// GET /api/integrations/whatsapp/session/status
router.get('/status', async (req, res) => {
  const ch = await channels.getChannel(req.orgId, 'whatsapp');
  if (!ch || ch.mode !== 'session') return res.json({ status: 'disconnected' });
  res.json({ status: ch.status });
});

// POST /api/integrations/whatsapp/session/logout
router.post('/logout', async (req, res) => {
  await waSession.logout();
  await channels.upsertChannel({
    org_id: req.orgId,
    type: 'whatsapp',
    mode: 'session',
    credentials: null,
    status: 'disconnected',
  });
  res.json({ ok: true });
});

export default router;
