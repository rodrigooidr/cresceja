import { Router } from 'express';
import { revoke } from '../services/instagramTokens.js';

const router = Router();

async function accountBelongs(db, orgId, accountId) {
  const { rowCount } = await db.query('SELECT 1 FROM instagram_accounts WHERE org_id=$1 AND id=$2', [orgId, accountId]);
  return rowCount > 0;
}

router.get('/api/orgs/:id/instagram/accounts', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT id, ig_user_id, username, name, is_active, created_at
         FROM instagram_accounts WHERE org_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.delete('/api/orgs/:id/instagram/accounts/:accountId', async (req, res, next) => {
  try {
    const { id, accountId } = { id: req.params.id, accountId: req.params.accountId };
    if (!(await accountBelongs(req.db, id, accountId))) return res.status(404).json({ error: 'not_found' });
    await revoke(req.db, accountId, id);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
