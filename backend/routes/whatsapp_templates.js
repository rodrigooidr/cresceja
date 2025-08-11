
import express from 'express';
import { query } from '../config/db-client.js';
const router = express.Router();

router.get('/', async (req,res)=>{
  const r = await query('SELECT * FROM whatsapp_templates ORDER BY updated_at DESC');
  res.json(r.rows);
});
router.post('/', async (req,res)=>{
  const { name, category='MARKETING', language='pt_BR', body } = req.body || {};
  if(!name || !body) return res.status(400).json({ error:'missing_fields' });
  const r = await query(
    `INSERT INTO whatsapp_templates (name, category, language, body, status)
     VALUES ($1,$2,$3,$4,'draft') RETURNING *`, [name, category, language, body]);
  res.status(201).json(r.rows[0]);
});
router.patch('/:id/status', async (req,res)=>{
  const { id } = req.params;
  const { status } = req.body || {};
  await query('UPDATE whatsapp_templates SET status=$1, updated_at=NOW() WHERE id=$2',[status, id]);
  res.json({ ok:true });
});

export default router;
