import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';

const router = Router();
router.use(authRequired, orgScope);

router.get('/oauth/start', (_req, res) => {
  res.json({ url: 'https://example.com/oauth' });
});

router.get('/status', (_req, res) => {
  res.json({ status: 'disconnected' });
});

router.get('/calendars', (_req, res) => {
  res.json({ items: [] });
});

router.post('/events', (_req, res) => {
  res.json({ ok: true });
});

router.post('/disconnect', (_req, res) => {
  res.json({ ok: true });
});

export default router;
