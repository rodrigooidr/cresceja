import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();
const isProd = String(process.env.NODE_ENV) === 'production';

router.get('/settings', authRequired, withOrg, async (_req, res) => {
  res.json({
    ai_enabled: true,
    handoff_keywords: ['humano','atendente','pessoa'],
    templates_channels: ['whatsapp','instagram','facebook']
  });
});

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
