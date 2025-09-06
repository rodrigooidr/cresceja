// backend/routes/integrations/meta.oauth.js
import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import channels from '../../services/channels.service.js';

const router = Router();

// ⚠️ Este router é montado em /api/integrations/meta no server.js
router.use(authRequired, orgScope);

// --- OAuth placeholders ---
router.get('/oauth/start', (_req, res) => {
  // TODO: implementar fluxo real de OAuth Meta
  res.json({ url: 'https://example.com/oauth' });
});

router.get('/oauth/callback', (_req, res) => {
  // TODO: tratar exchange de code por token e salvar credenciais
  res.json({ ok: true });
});

// --- Catálogos Meta (stubs para não quebrar a UI) ---
// O frontend espera { items: [] }
router.get('/pages', (_req, res) => {
  res.json({ items: [] });
});

router.get('/ig-accounts', (_req, res) => {
  res.json({ items: [] });
});

// --- Webhook check ---
router.get('/webhook-check', (_req, res) => {
  res.json({ verified: false });
});

// --- Conexão Facebook ---
router.post('/facebook/connect', async (req, res, next) => {
  try {
    const { page_id, access_token } = req.body || {};
    if (!page_id) return res.status(400).json({ error: 'page_id_required' });

    const channel = await channels.upsertChannel({
      org_id: req.orgId,
      type: 'facebook',
      mode: 'cloud',
      credentials: { page_id, access_token },
      status: 'connected',
    });

    res.json({ ok: true, channel });
  } catch (err) {
    next(err);
  }
});

router.get('/facebook/status', async (req, res) => {
  const ch = await channels.getChannel(req.orgId, 'facebook');
  if (!ch) return res.json({ status: 'disconnected' });
  res.json({ status: ch.status || 'connected', page_id: ch.credentials?.page_id });
});

router.get('/facebook/test', async (req, res) => {
  const ch = await channels.getChannel(req.orgId, 'facebook');
  const status = ch ? (ch.status || 'connected') : 'disconnected';
  res.json({ status, webhook: false });
});

// --- Conexão Instagram ---
router.post('/instagram/connect', async (req, res, next) => {
  try {
    const { ig_id, page_id, access_token } = req.body || {};
    if (!ig_id) return res.status(400).json({ error: 'ig_id_required' });

    const channel = await channels.upsertChannel({
      org_id: req.orgId,
      type: 'instagram',
      mode: 'cloud',
      credentials: { ig_id, page_id, access_token },
      status: 'connected',
    });

    res.json({ ok: true, channel });
  } catch (err) {
    next(err);
  }
});

router.get('/instagram/status', async (req, res) => {
  const ch = await channels.getChannel(req.orgId, 'instagram');
  if (!ch) return res.json({ status: 'disconnected' });
  res.json({ status: ch.status || 'connected', ig_id: ch.credentials?.ig_id });
});

router.get('/instagram/test', async (req, res) => {
  const ch = await channels.getChannel(req.orgId, 'instagram');
  const status = ch ? (ch.status || 'connected') : 'disconnected';
  res.json({ status, webhook: false });
});

export default router;
