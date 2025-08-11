
import { Router } from 'express';
import { getCreditStatus, consumeCredit } from '../services/credits.js';

export const router = Router();

router.get('/status', async (req,res)=>{
  const status = await getCreditStatus(req.user.id);
  res.json(status);
});

router.post('/consume', async (req,res)=>{
  const { category, amount } = req.body || {};
  const ok = await consumeCredit(req.user.id, category || 'attend', Number(amount) || 1);
  if(!ok) return res.status(402).json({ error: 'credit_exhausted' });
  res.json({ ok: true });
});
