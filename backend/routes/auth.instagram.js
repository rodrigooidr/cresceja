import { Router } from 'express';
import crypto from 'crypto';
import { authRequired, impersonationGuard } from '../middleware/auth.js';
import { getFeatureAllowance, getUsage } from '../services/features.js';
import { query } from '#db';
import { saveTokens } from '../services/instagramTokens.js';

const router = Router();
const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function setOrgId(req, _res, next) {
  const impersonate = req.get('X-Impersonate-Org-Id');
  if (impersonate) req.orgId = impersonate;
  else if (req.query.orgId) req.orgId = String(req.query.orgId);
  else if (req.user?.org_id) req.orgId = req.user.org_id;
  next();
}

function cleanupStates() {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (v.createdAt + STATE_TTL_MS < now) stateStore.delete(k);
  }
}

router.get('/api/auth/instagram/start', authRequired, impersonationGuard, setOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId;
    const allowed = ['/settings'];
    const rt = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/settings';
    let pathname;
    try { pathname = new URL(rt, 'http://localhost').pathname; } catch { pathname = '/settings'; }
    const returnTo = allowed.includes(pathname) ? pathname : '/settings';

    const allow = await getFeatureAllowance(orgId, 'instagram_accounts', req.db);
    if (!allow.enabled || allow.limit === 0) return res.status(403).json({ error: 'feature_disabled' });
    const used = await getUsage(orgId, 'instagram_accounts', req.db);
    if (Number.isInteger(allow.limit) && used >= allow.limit) {
      return res.status(403).json({ error: 'feature_limit_reached', used, limit: allow.limit });
    }

    const state = crypto.randomUUID();
    cleanupStates();
    stateStore.set(state, { orgId, returnTo, createdAt: Date.now() });
    const scopes = ['instagram_basic','pages_show_list','instagram_content_publish'];
    const params = new URLSearchParams({
      client_id: process.env.IG_APP_ID,
      redirect_uri: process.env.IG_REDIRECT_URI,
      scope: scopes.join(','),
      state,
      response_type: 'code'
    });
    res.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`);
  } catch (e) { next(e); }
});

router.get('/api/auth/instagram/callback', async (req, res, next) => {
  try {
    const { state, code } = req.query;
    cleanupStates();
    const st = stateStore.get(state);
    if (!st) return res.status(400).json({ error: 'invalid_state' });
    stateStore.delete(state);

    let tok;
    try {
      const params = new URLSearchParams({
        client_id: process.env.IG_APP_ID,
        client_secret: process.env.IG_APP_SECRET,
        redirect_uri: process.env.IG_REDIRECT_URI,
        code,
      });
      const r = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${params.toString()}`);
      if (!r.ok) throw new Error('token');
      tok = await r.json();
    } catch {
      return res.status(502).json({ error: 'oauth_exchange_failed' });
    }
    const infoRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,username,name&access_token=${tok.access_token}`);
    const info = await infoRes.json();

    const { rows: [acc] } = await query(
      `INSERT INTO instagram_accounts (org_id, ig_user_id, username, name, is_active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (org_id, ig_user_id) DO UPDATE
            SET username=EXCLUDED.username,
                name=EXCLUDED.name,
                is_active=true,
                updated_at=now()
         RETURNING id`,
      [st.orgId, info.id, info.username, info.name]
    );
    await saveTokens(req.db, acc.id, { access_token: tok.access_token, scopes: tok.scope ? tok.scope.split(',') : [], expiry: tok.expires_in ? new Date(Date.now()+tok.expires_in*1000) : null });

    const redirectTo = st.returnTo.includes('?') ? `${st.returnTo}&ig_connected=1` : `${st.returnTo}?ig_connected=1`;
    res.redirect(redirectTo);
  } catch (e) { next(e); }
});

export default router;
