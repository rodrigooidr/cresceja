
import { Router } from 'express';
import { sendText } from '../services/whatsappCloud.js';

export const router = Router();

router.post('/send', async (req,res)=>{
  const { to, text } = req.body || {};
  if(!to || !text) return res.status(400).json({error:'missing_fields'});
  const ok = await sendText(to, text);
  res.json({ ok });
});
