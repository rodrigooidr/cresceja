import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/inbox/alerts', (_req, res) => res.json({ ok: true }));

router.get('/inbox/alerts/stream', (req, res) => {
  const qToken = req.query.access_token;
  let user = req.user;

  if (!user && qToken) {
    try {
      user = jwt.verify(qToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }
  }

  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const orgId =
    req.query.orgId ||
    req.get('x-org-id') ||
    req.org?.id ||
    user.org_id;

  if (!orgId && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'org_required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const timer = setInterval(() => {
    res.write(`event: ping\ndata: {"t":${Date.now()},"orgId":"${orgId || ''}"}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(timer);
  });

  res.write('event: ready\n');
  res.write('data: {"ok":true}\n\n');
});

export default router;
