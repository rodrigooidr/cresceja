import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';

import leads from './leads.js';
import subscription from './subscription.js';
import posts from './posts.js';
import approvals from './approvals.js';
import audit from './audit.js';
import credits from './credits.js';
import whatsapp from './whatsapp.js';

const router = Router();

router.use(auditMiddleware);

router.use('/leads', leads);
router.use('/subscription', authRequired, subscription);
router.use('/posts', authRequired, posts);
router.use('/approvals', authRequired, approvals);
router.use('/audit', authRequired, audit);
router.use('/ai-credits', authRequired, credits);
router.use('/omnichannel/whatsapp', authRequired, whatsapp);

// Endpoints simples de onboarding (podem ser movidos para um controller próprio)
router.get('/onboarding/progress', authRequired, (req, res) => {
  res.json({ completed_steps: 2, total_steps: 5, steps: ['Conta criada', 'WhatsApp conectado'] });
});

router.post('/onboarding/check', authRequired, (req, res) => {
  res.json({ ok: true });
});

export default router;
