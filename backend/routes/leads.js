// backend/routes/leads.js
import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Se quiser proteger tudo com auth, descomente a linha abaixo.
// router.use(authenticate);

const leadSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source_channel: z.string().default('landing'),
  consent: z.boolean().default(true),
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, source_channel, consent } = leadSchema.parse(req.body ?? {});

    const { rows } = await query(
      `INSERT INTO public.leads (name, email, phone, source_channel, consent)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [name, email ?? null, phone ?? null, source_channel, consent]
    );
    const leadId = rows[0].id;

    // auto-create CRM opportunity (status 'novo')
    await query(
      `INSERT INTO public.crm_opportunities (lead_id, stage, amount, notes)
       VALUES ($1,'novo',0,'Criado via landing page')`,
      [leadId]
    );

    return res.status(201).json({ id: leadId });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ error: 'invalid_body', details: err.issues });
    }
    console.error('[leads] POST / error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Exemplo de rota protegida (lista últimos 100 leads)
router.get('/list', authenticate, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, phone, source_channel, consent, created_at
         FROM public.leads
        ORDER BY created_at DESC
        LIMIT 100`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[leads] GET /list error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

