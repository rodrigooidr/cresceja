import { Router } from 'express';
import { requireFeature } from '../middleware/requireFeature.js';
import { refreshIfNeeded, forceRefresh, revokeTokens } from '../services/calendar/googleTokens.js';

const router = Router();

async function accountBelongs(db, orgId, accountId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM google_calendar_accounts WHERE org_id=$1 AND id=$2',
    [orgId, accountId]
  );
  return rowCount > 0;
}

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

// Força refresh do token
router.post('/api/orgs/:id/calendar/accounts/:accountId/refresh', async (req, res, next) => {
  try {
    const { id, accountId } = { id: req.params.id, accountId: req.params.accountId };
    if (!(await accountBelongs(req.db, id, accountId))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const creds = await forceRefresh(req.db, accountId, id);
    if (!creds) return res.status(404).json({ error: 'not_found' });
    res.json({ expiry: creds.expiry_date ? new Date(creds.expiry_date).toISOString() : null });
  } catch (e) { next(e); }
});

// Revoga tokens e desativa conta
router.post('/api/orgs/:id/calendar/accounts/:accountId/revoke', async (req, res, next) => {
  try {
    const { id, accountId } = { id: req.params.id, accountId: req.params.accountId };
    if (!(await accountBelongs(req.db, id, accountId))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const ok = await revokeTokens(req.db, accountId, id);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Lista calendários da conta
router.get('/api/orgs/:id/calendar/accounts/:accountId/calendars', async (req, res, next) => {
  try {
    const { id, accountId } = { id: req.params.id, accountId: req.params.accountId };
    if (!(await accountBelongs(req.db, id, accountId))) {
      return res.status(404).json({ error: 'not_found' });
    }
    let tok = await refreshIfNeeded(req.db, accountId, id);
    if (!tok) return res.status(404).json({ error: 'not_found' });
    const headers = { Authorization: 'Bearer ' + tok.access_token };
    try {
      const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers });
      if (r.status === 401) throw { status: 401 };
      const data = await r.json();
      return res.json(data);
    } catch (err) {
      if (err.status === 401) {
        try {
          await forceRefresh(req.db, accountId, id);
          tok = await refreshIfNeeded(req.db, accountId, id);
          const r2 = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { Authorization: 'Bearer ' + tok.access_token },
          });
          if (!r2.ok) throw new Error('fail');
          const data = await r2.json();
          return res.json(data);
        } catch {
          await req.db.query(
            'UPDATE google_calendar_accounts SET is_active=false, updated_at=now() WHERE org_id=$1 AND id=$2',
            [id, accountId]
          );
          return res.status(409).json({ error: 'reauth_required' });
        }
      }
      return next(err);
    }
  } catch (e) { next(e); }
});

// Lista eventos de um calendário
router.get('/api/orgs/:id/calendar/accounts/:accountId/events', async (req, res, next) => {
  try {
    const { id, accountId } = { id: req.params.id, accountId: req.params.accountId };
    const { calendarId, from, to } = req.query || {};
    if (!calendarId) return res.status(422).json({ error: 'validation', field: 'calendarId' });
    if (!(await accountBelongs(req.db, id, accountId))) {
      return res.status(404).json({ error: 'not_found' });
    }
    let tok = await refreshIfNeeded(req.db, accountId, id);
    if (!tok) return res.status(404).json({ error: 'not_found' });
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    if (from) url.searchParams.set('timeMin', from);
    if (to) url.searchParams.set('timeMax', to);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    try {
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok.access_token } });
      if (r.status === 401) throw { status: 401 };
      const data = await r.json();
      return res.json(data);
    } catch (err) {
      if (err.status === 401) {
        try {
          await forceRefresh(req.db, accountId, id);
          tok = await refreshIfNeeded(req.db, accountId, id);
          const r2 = await fetch(url, { headers: { Authorization: 'Bearer ' + tok.access_token } });
          if (!r2.ok) throw new Error('fail');
          const data = await r2.json();
          return res.json(data);
        } catch {
          await req.db.query(
            'UPDATE google_calendar_accounts SET is_active=false, updated_at=now() WHERE org_id=$1 AND id=$2',
            [id, accountId]
          );
          return res.status(409).json({ error: 'reauth_required' });
        }
      }
      return next(err);
    }
  } catch (e) { next(e); }
});

export default router;
