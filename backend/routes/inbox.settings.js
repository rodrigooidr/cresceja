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

router.get('/quick-replies', (req, res) => {
  if (!req.org?.id && isProd) return res.json([]);
  return res.json([
    { id: 'saudacao', text: 'Olá! Como posso te ajudar?' },
    { id: 'retorno', text: 'Já verifico e retorno em instantes.' },
  ]);
});

router.get('/templates', (req, res) => {
  if (!req.org?.id && isProd) return res.json([]);
  return res.json([]);
});

router.get('/conversations', (_req, res) => {
  res.status(410).json({ error: 'use /api/inbox/conversations (nova rota)' });
});

export default router;
