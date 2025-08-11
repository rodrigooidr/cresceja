
import express from 'express';
import { query, getClient } from '../config/db-client.js';
const router = express.Router();

// Registrar/atualizar consentimento de um lead
router.post('/consent', async (req,res)=>{
  const { lead_id, consent, purpose='atendimento' } = req.body || {};
  if(!lead_id || typeof consent !== 'boolean') return res.status(400).json({ error: 'missing_fields' });
  await query('UPDATE leads SET consent=$1 WHERE id=$2',[consent, lead_id]);
  await query('INSERT INTO lgpd_consents (lead_id, consent, purpose) VALUES ($1,$2,$3)',[lead_id, consent, purpose]);
  res.json({ ok:true });
});

// Exportação dos dados do titular (DSAR)
router.get('/export/:leadId', async (req,res)=>{
  const { leadId } = req.params;
  const client = await getClient();
  try{
    const lead = (await client.query('SELECT * FROM leads WHERE id=$1',[leadId])).rows[0];
    if(!lead) return res.status(404).json({ error: 'not_found' });
    const conv = (await client.query('SELECT * FROM conversations WHERE lead_id=$1',[leadId])).rows;
    const msgs = (await client.query('SELECT * FROM messages WHERE lead_id=$1 ORDER BY created_at ASC',[leadId])).rows;
    const opps = (await client.query('SELECT * FROM crm_opportunities WHERE lead_id=$1',[leadId])).rows;
    res.setHeader('Content-Type','application/json');
    res.setHeader('Content-Disposition', `attachment; filename="export-${leadId}.json"`);
    res.end(JSON.stringify({ lead, conversations:conv, messages:msgs, opportunities:opps }, null, 2));
  } finally {
    client.release();
  }
});

// Solicitação de eliminação (soft-delete)
router.post('/erase', async (req,res)=>{
  const { lead_id } = req.body || {};
  if(!lead_id) return res.status(400).json({ error: 'missing_lead_id' });
  await query('UPDATE leads SET erased_at=NOW() WHERE id=$1',[lead_id]);
  await query('INSERT INTO lgpd_erasure_requests (lead_id) VALUES ($1)',[lead_id]);
  res.json({ ok:true });
});

export default router;
