import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();
const isProd = String(process.env.NODE_ENV) === 'production';

router.get('/inbox/alerts', authRequired, withOrg, (req, res) => {
  if (!req.org?.id && !isProd) {
    return res.json({ ok: true, items: [] });
  }
  return res.json({ ok: true });
});

router.get('/inbox/alerts/stream', authRequired, withOrg, (req, res) => {
  const orgId = req.org?.id || null;

  if (!orgId && isProd) {
    return res.status(403).json({ error: 'ORG_REQUIRED' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const payloadOrg = orgId || '';

  const timer = setInterval(() => {
    res.write(`event: ping\ndata: {"t":${Date.now()},"orgId":"${payloadOrg}"}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(timer);
  });

  res.write('event: ready\n');
  res.write(`data: {"ok":true,"orgId":"${payloadOrg}"}\n\n`);
});

export default router;
