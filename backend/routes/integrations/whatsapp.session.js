import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import { requireAnyRole } from '../../middlewares/auth.js';
import waSession from '../../services/wa.session.js';

const router = Router();
router.use(authRequired, orgScope);

const requireWhatsAppSessionRole = requireAnyRole(['SuperAdmin', 'OrgOwner']);

router.post('/start', requireWhatsAppSessionRole, async (req, res) => {
  await waSession.start(req.orgId, req.app.get('io'));
  res.json({ ok: true });
});

router.get('/status', requireWhatsAppSessionRole, async (_req, res) => {
  const { status } = await waSession.getStatus();
  res.json({ status });
});

router.post('/logout', requireWhatsAppSessionRole, async (req, res) => {
  await waSession.logout(req.orgId, req.app.get('io'));
  res.json({ ok: true });
});

router.get('/test', requireWhatsAppSessionRole, async (req, res) => {
  const data = await waSession.test();
  res.json(data);
});

export default router;
