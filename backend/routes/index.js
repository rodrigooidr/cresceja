
import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { router as leads } from './leads.js';
import { router as subscription } from './subscription.js';
import { router as posts } from './posts.js';
import { router as approvals } from './approvals.js';
import { router as audit } from './audit.js';
import { router as credits } from './credits.js';
import { router as whatsapp } from './whatsapp.js';

export const router = Router();

router.use(auditMiddleware);

router.use('/leads', leads);
router.use('/subscription', authRequired, subscription);
router.use('/posts', authRequired, posts);
router.use('/approvals', authRequired, approvals);
router.use('/audit', authRequired, audit);
router.use('/ai-credits', authRequired, credits);
router.use('/omnichannel/whatsapp', authRequired, whatsapp);

router.get('/onboarding/progress', authRequired, (req,res)=>{
  res.json({ completed_steps: 2, total_steps: 5, steps: ['Conta criada','WhatsApp conectado'] });
});

router.post('/onboarding/check', authRequired, (req,res)=>{
  res.json({ ok: true });
});
