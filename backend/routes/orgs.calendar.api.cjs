const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { impersonation: allowImpersonation } = require('../middleware/impersonalization');
const { refreshIfNeeded, revoke } = require('../services/googleTokens.cjs');

function cfg() {
  return {
    cid: process.env.GOOGLE_CLIENT_ID,
    csec: process.env.GOOGLE_CLIENT_SECRET
  };
}

// Refresh manual (admin/support)
router.post('/api/orgs/:id/calendar/accounts/:accountId/refresh', requireAuth, allowImpersonation, async (req,res,next)=>{
  try {
    const { cid, csec } = cfg();
    const { accountId } = req.params;
    const { access_token, expiry } = await refreshIfNeeded(req.db, accountId, cid, csec);
    res.json({ ok:true, expiry });
  } catch (e) {
    if (e.code === 'no_token' || e.code === 'no_refresh') return res.status(404).json({ error:e.code });
    return next(e);
  }
});

// Revogar
router.post('/api/orgs/:id/calendar/accounts/:accountId/revoke', requireAuth, allowImpersonation, async (req,res,next)=>{
  try {
    const { id, accountId } = { id:req.params.id, accountId:req.params.accountId };
    await revoke(req.db, accountId);
    await req.db.query(`UPDATE google_calendar_accounts SET is_active=false, updated_at=now() WHERE org_id=$1 AND id=$2`, [id, accountId]);
    res.json({ ok:true });
  } catch (e) { next(e); }
});

// Lista calendários da conta
router.get('/api/orgs/:id/calendar/accounts/:accountId/calendars', requireAuth, allowImpersonation, async (req,res,next)=>{
  try {
    const { cid, csec } = cfg();
    const { accountId } = req.params;
    const { access_token } = await refreshIfNeeded(req.db, accountId, cid, csec);
    const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers:{ Authorization:`Bearer ${access_token}` }});
    if (!r.ok) return res.status(r.status).json(await r.json());
    const data = await r.json(); // { items: [...] }
    res.json(data.items?.map(c => ({ id:c.id, summary:c.summary, primary:!!c.primary })) || []);
  } catch (e) { next(e); }
});

// Lista eventos (intervalo)
router.get('/api/orgs/:id/calendar/accounts/:accountId/events', requireAuth, allowImpersonation, async (req,res,next)=>{
  try {
    const { cid, csec } = cfg();
    const { accountId } = req.params;
    const { calendarId, from, to, maxResults='50' } = req.query;
    if (!calendarId) return res.status(422).json({ error:'validation', field:'calendarId' });

    const { access_token } = await refreshIfNeeded(req.db, accountId, cid, csec);
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    if (from) url.searchParams.set('timeMin', new Date(from).toISOString());
    if (to)   url.searchParams.set('timeMax', new Date(to).toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', maxResults);

    const r = await fetch(url, { headers:{ Authorization:`Bearer ${access_token}` }});
    if (!r.ok) return res.status(r.status).json(await r.json());
    const data = await r.json();
    const items = (data.items || []).map(ev => ({
      id: ev.id,
      summary: ev.summary,
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      location: ev.location || null,
      status: ev.status
    }));
    res.json(items);
  } catch (e) { next(e); }
});

module.exports = router;
