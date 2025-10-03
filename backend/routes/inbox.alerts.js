import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = express.Router();

router.get('/alerts', authRequired, withOrg, (_req, res) => res.status(204).end());

router.get('/alerts/stream', authRequired, withOrg, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const pingId = setInterval(() => {
    res.write('event: ping\n');
    res.write('data: {"ok":true}\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(pingId);
    try {
      res.end();
    } catch {}
  });

  const initial = JSON.stringify({ ready: true, orgId: req.orgId });
  res.write(`data: ${initial}\n\n`);
});

export default router;
