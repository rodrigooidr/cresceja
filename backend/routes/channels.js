import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';

const router = Router();

router.get('/summary', async (req, res) => {
  const orgId = req.orgId;
  try {
    const q = await req.db.query(
      `select type, mode, status from channels where org_id = $1`,
      [orgId]
    );
    const rows = q.rows || [];
    const find = (t, m) => rows.find((r) => r.type === t && (m ? r.mode === m : true));

    const whatsapp_official = find('whatsapp', 'cloud') || { status: 'disconnected' };
    const whatsapp_session = find('whatsapp', 'session') || { status: 'disconnected' };
    const instagram = find('instagram') || { status: 'disconnected' };
    const facebook = find('facebook') || { status: 'disconnected' };

    const allowed = (process.env.ALLOW_WA_SESSION || 'true') === 'true';

    res.json({
      whatsapp_official,
      whatsapp_session: { ...whatsapp_session, allowed },
      instagram,
      facebook,
    });
  } catch (e) {
    res.status(500).json({ error: 'internal_error', detail: e.message });
  }
});

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
  } catch (e) {
    next(e);
  }
});

export default router;
