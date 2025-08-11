
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';

export const router = Router();

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source_channel: z.string().default('landing'),
  consent: z.boolean().default(true)
});

router.post('/', async (req,res)=>{
  const parsed = leadSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'invalid_body', details: parsed.error.flatten()});

  const { name, email, phone, source_channel, consent } = parsed.data;
  const r = await query(
    `INSERT INTO leads (name, email, phone, source_channel, consent) 
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, email || null, phone || null, source_channel, consent]
  );

  // auto-create CRM opportunity (status novo)
  await query(
    `INSERT INTO crm_opportunities (lead_id, stage, amount, notes) VALUES ($1,'novo',0,'Criado via landing page')`,
    [r.rows[0].id]
  );

  res.status(201).json({ id: r.rows[0].id });
});
