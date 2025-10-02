import { Router } from 'express';
import { requireRole, ROLES } from '../middleware/requireRole.js';

const router = Router();

// Rascunho: OrgAgent (se liberado), OrgAdmin, OrgOwner
router.post('/', requireRole(ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner), async (req, res, next) => {
  try {
    // verificação de toggle opcionalmente no handler ou em outro middleware
    const { title, content } = req.body;
    await req.db.query(
      `INSERT INTO posts (org_id, title, content, status, created_at)
       VALUES (current_setting('app.org_id')::uuid, $1, $2, 'draft', now())`,
      [title, content]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Publicar: somente OrgAdmin/OrgOwner
router.post('/:id/publish', requireRole(ROLES.OrgAdmin, ROLES.OrgOwner), async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query(
      `UPDATE posts
         SET status='scheduled', updated_at=now()
       WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid`,
      [id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
