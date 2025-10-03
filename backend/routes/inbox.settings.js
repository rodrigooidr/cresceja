import { Router } from 'express';

const router = Router();

router.get('/inbox/templates', (_req, res) => res.json([]));
router.get('/inbox/quick-replies', (_req, res) => res.json([]));
router.get('/inbox/conversations', (req, res) => {
  const { status = 'open', limit = 50 } = req.query;
  res.json({ items: [], status, limit: Number(limit) });
});

export default router;
