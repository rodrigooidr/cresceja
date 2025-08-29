import express from 'express';
const router = express.Router();
import { Pool } from 'pg';
import { authRequired, requireRole } from '../middleware/auth.js';
import fs from 'fs/promises';
import path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authRequired, requireRole('owner', 'client_admin'));

router.post('/:type/connect', async (req, res) => {
  const user = req.user;
  const companyId = user.company_id;
  const { type } = req.params;
  const { config } = req.body || {};

  try {
    const q = `
      INSERT INTO integrations (company_id, type, status, config, allowed_for_all, enabled_by)
      VALUES ($1, $2, 'connected', $3, COALESCE($4,false), $5)
      ON CONFLICT (company_id, type)
      DO UPDATE SET status='connected', config=$3, updated_at=NOW()
      RETURNING *;
    `;
    const { rows } = await pool.query(q, [companyId, type, config || {}, false, user.id]);

    try {
      const cfgDir = path.join(process.cwd(), 'config', 'integrations');
      await fs.mkdir(cfgDir, { recursive: true });
      const filePath = path.join(cfgDir, `${companyId}-${type}.json`);
      await fs.writeFile(filePath, JSON.stringify(config || {}, null, 2));
    } catch (err) {
      console.error('integrations file write error', err);
    }

    return res.json({ ok: true, integration: rows[0] });
  } catch (e) {
    console.error('integrations connect error', e);
    return res.status(500).json({ ok:false, error:'Falha ao salvar integração' });
  }
});

router.get('/:type/status', async (req, res) => {
  const user = req.user;
  const companyId = user.company_id;
  const { type } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM integrations WHERE company_id=$1 AND type=$2 LIMIT 1',
      [companyId, type]
    );
    return res.json({ ok:true, integration: rows[0] || null });
  } catch (e) {
    console.error('integrations status error', e);
    return res.status(500).json({ ok:false, error:'Falha ao consultar status' });
  }
});

router.post('/whatsapp_web/allow-all', async (req, res) => {
  const user = req.user;
  const companyId = user.company_id;
  try {
    const { rows } = await pool.query(
      `INSERT INTO integrations (company_id, type, status, config, allowed_for_all, enabled_by)
       VALUES ($1, 'whatsapp_web', 'connected', '{}', true, $2)
       ON CONFLICT (company_id, type)
       DO UPDATE SET allowed_for_all=true, updated_at=NOW()
       RETURNING *;`,
      [companyId, user.id]
    );
    return res.json({ ok:true, integration: rows[0] });
  } catch (e) {
    console.error('allow-all error', e);
    return res.status(500).json({ ok:false, error:'Falha ao habilitar' });
  }
});

export default router;



