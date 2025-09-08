import express from 'express';
const router = express.Router();

// Cria lead + oportunidade CRM, registrando canal de origem
router.post('/', async (req, res) => {
  const { name, email, whatsapp, channel } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
  }

  try {
    const db = req.db;
    // Garante tabelas simples
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        whatsapp TEXT,
        source TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.crm_opportunities (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES public.leads(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        whatsapp TEXT,
        status TEXT NOT NULL DEFAULT 'novo',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    const leadResult = await db.query(
      'INSERT INTO public.leads (name, email, whatsapp, source) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, whatsapp, channel]
    );
    const leadId = leadResult.rows[0].id;

    await db.query(
      'INSERT INTO public.crm_opportunities (lead_id, name, email, whatsapp) VALUES ($1, $2, $3, $4)',
      [leadId, name, email, whatsapp]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar lead/crm:', err);
    res.status(500).json({ error: 'Erro interno ao salvar lead' });
  }
});

export default router;


