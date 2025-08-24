import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';

const router = Router();

// Apenas OrgOwner (ou SuperAdmin) conecta/desconecta provedores
router.post('/connect', requireRole(ROLES.OrgOwner), async (req, res, next) => {
  try {
    const { provider, config } = req.body;
    await req.db.query(
      `INSERT INTO channels (org_id, provider, config, created_at)
       VALUES (current_setting('app.org_id')::uuid, $1, $2, now())`,
      [provider, config]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
