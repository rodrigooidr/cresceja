import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import channels from '../../services/channels.service.js';

const router = Router();
router.use(authRequired, orgScope);

// GET /api/integrations/meta/oauth/start
router.get('/meta/oauth/start', (_req, res) => {
  // placeholder URL; fluxo real de OAuth deve ser implementado
  res.json({ url: 'https://example.com/oauth' });
});

// GET /api/integrations/meta/oauth/callback
router.get('/meta/oauth/callback', (_req, res) => {
  res.json({ ok: true });
});

// GET /api/integrations/meta/pages
router.get('/meta/pages', (_req, res) => {
  res.json({ data: [] });
});

// POST /api/integrations/facebook/connect
router.post('/facebook/connect', async (req, res) => {
  const { page_id } = req.body || {};
  await channels.upsertChannel({
    org_id: req.orgId,
    type: 'facebook',
    mode: 'cloud',
    credentials: { page_id },
    status: 'connected',
  });
  res.json({ ok: true });
});

// GET /api/integrations/meta/ig-accounts
router.get('/meta/ig-accounts', (_req, res) => {
  res.json({ data: [] });
});

// POST /api/integrations/instagram/connect
router.post('/instagram/connect', async (req, res) => {
  const { ig_id, page_id } = req.body || {};
  await channels.upsertChannel({
    org_id: req.orgId,
    type: 'instagram',
    mode: 'cloud',
    credentials: { ig_id, page_id },
    status: 'connected',
  });
  res.json({ ok: true });
});

export default router;
