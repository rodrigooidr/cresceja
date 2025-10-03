import { Router } from 'express';

const router = Router();
const isProd = String(process.env.NODE_ENV) === 'production';

router.get('/templates', (req, res) => {
  if (!req.org?.id && !isProd) return res.json([]);
  return res.json([]);
});
router.get('/quick-replies', (req, res) => {
  if (!req.org?.id && !isProd) return res.json([]);
  return res.json([]);
});
router.get('/conversations', (req, res) => {
  if (!req.org?.id && !isProd) {
    const { status = 'open', limit = 50 } = req.query;
    return res.json({ items: [], status, limit: Number(limit) });
  }
  const { status = 'open', limit = 50 } = req.query;
  res.json({ items: [], status, limit: Number(limit) });
});

export default router;
