import { Router } from 'express';
import { requireFeature } from '../middleware/requireFeature.js';

const router = Router();

// Lista contas
router.get('/api/orgs/:id/calendar/accounts', async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const { rows } = await req.db.query(
      `SELECT id, google_user_id, email, display_name, is_active, created_at
         FROM google_calendar_accounts
        WHERE org_id = $1
        ORDER BY created_at ASC`,
      [orgId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Cria/conecta (mock de callback OAuth)
// Protegido por gating do plano
router.post('/api/orgs/:id/calendar/accounts', requireFeature('google_calendar_accounts'), async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const { google_user_id, email, display_name } = req.body || {};
    if (!google_user_id) return res.status(422).json({ error: 'validation', field: 'google_user_id' });

    const { rows } = await req.db.query(
      `INSERT INTO google_calendar_accounts (org_id, google_user_id, email, display_name, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (org_id, google_user_id) DO UPDATE
            SET email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                is_active = true,
                updated_at = now()
         RETURNING id, google_user_id, email, display_name, is_active`,
      [orgId, google_user_id, email, display_name]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'duplicate' });
    next(e);
  }
});

// Remove/desconecta
router.delete('/api/orgs/:id/calendar/accounts/:accountId', async (req, res, next) => {
  try {
    const { id, accountId } = { id: req.params.id, accountId: req.params.accountId };
    await req.db.query(`DELETE FROM google_calendar_accounts WHERE org_id=$1 AND id=$2`, [id, accountId]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
