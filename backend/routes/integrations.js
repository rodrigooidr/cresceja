import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

router.use(authRequired, requireRole('owner', 'client_admin'));

router.post('/:type/connect', async (req, res) => {
  const db = req.db;
  const user = req.user;
  const { type } = req.params;
  const { config } = req.body || {};

  try {
    const q = `
      INSERT INTO integrations (company_id, type, status, config, allowed_for_all, enabled_by)
      VALUES (current_setting('app.org_id')::uuid, $1, 'connected', $2, COALESCE($3,false), $4)
      ON CONFLICT (company_id, type)
      DO UPDATE SET status='connected', config=$2, updated_at=NOW()
      RETURNING *;
    `;
    const { rows } = await db.query(q, [type, config || {}, false, user.id]);

    try {
      const cfgDir = path.join(process.cwd(), 'config', 'integrations');
      await fs.mkdir(cfgDir, { recursive: true });
      const filePath = path.join(cfgDir, `${req.orgId}-${type}.json`);
      await fs.writeFile(filePath, JSON.stringify(config || {}, null, 2));
    } catch (err) {
      console.error('integrations file write error', err);
    }

    return res.json({ ok: true, integration: rows[0] });
  } catch (e) {
    console.error('integrations connect error', e);
    return res.status(500).json({ ok: false, error: 'Falha ao salvar integração' });
  }
});

router.get('/:type/status', async (req, res) => {
  const db = req.db;
  const { type } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT * FROM integrations WHERE type=$1 LIMIT 1',
      [type]
    );
    return res.json({ ok: true, integration: rows[0] || null });
  } catch (e) {
    console.error('integrations status error', e);
    return res.status(500).json({ ok: false, error: 'Falha ao consultar status' });
  }
});

router.post('/whatsapp_web/allow-all', async (req, res) => {
  const db = req.db;
  const user = req.user;
  try {
    const { rows } = await db.query(
      `INSERT INTO integrations (company_id, type, status, config, allowed_for_all, enabled_by)
       VALUES (current_setting('app.org_id')::uuid, 'whatsapp_web', 'connected', '{}', true, $1)
       ON CONFLICT (company_id, type)
       DO UPDATE SET allowed_for_all=true, updated_at=NOW()
       RETURNING *;`,
      [user.id]
    );
    return res.json({ ok: true, integration: rows[0] });
  } catch (e) {
    console.error('allow-all error', e);
    return res.status(500).json({ ok: false, error: 'Falha ao habilitar' });
  }
});

export default router;



