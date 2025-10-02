import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();

router.get('/alerts', authRequired, withOrg, (_req, res) => res.status(204).end());

router.get('/alerts/stream', authRequired, withOrg, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  const send = (event, data) => { res.write(`event: ${event}\n`); res.write(`data: ${JSON.stringify(data)}\n\n`); };
  send('ready', { ok: true, orgId: req.orgId || null });
  const hb = setInterval(() => res.write(': hb\n\n'), 15000);
  req.on('close', () => { clearInterval(hb); try { res.end(); } catch {} });
});

export default router;
