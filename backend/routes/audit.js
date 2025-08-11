
import { Router } from 'express';
import { query } from '../config/db.js';

export const router = Router();

router.get('/usage', async (req,res)=>{
  const r = await query('SELECT * FROM ai_credit_usage WHERE user_id=$1 ORDER BY period_start DESC LIMIT 12', [req.user.id]);
  res.json(r.rows);
});

router.get('/activity', async (req,res)=>{
  const r = await query('SELECT * FROM audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200', [req.user.id]);
  res.json(r.rows);
});
