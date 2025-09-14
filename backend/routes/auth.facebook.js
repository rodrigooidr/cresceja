import { Router } from 'express';
import crypto from 'crypto';
import { authRequired, impersonationGuard } from '../middleware/auth.js';
import { getFeatureAllowance, getUsage } from '../services/features.js';
import { query } from '#db';
import { encrypt } from '../services/crypto.js';

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

router.get('/api/auth/facebook/start', authRequired, impersonationGuard, setOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId;
    const allowed = ['/settings'];
    const rt = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/settings';
    let pathname;
    try {
      pathname = new URL(rt, 'http://localhost').pathname;
    } catch {
      pathname = '/settings';
    }
    const returnTo = allowed.includes(pathname) ? pathname : '/settings';

    const allow = await getFeatureAllowance(orgId, 'facebook_pages', req.db);
    if (!allow.enabled || allow.limit === 0) {
      return res.status(403).json({ error: 'feature_disabled' });
    }
    const used = await getUsage(orgId, 'facebook_pages', req.db);
    if (Number.isInteger(allow.limit) && used >= allow.limit) {
      return res.status(403).json({ error: 'feature_limit_reached', used, limit: allow.limit });
    }

    const state = crypto.randomUUID();
    cleanupStates();
    stateStore.set(state, { orgId, returnTo, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      redirect_uri: process.env.FB_REDIRECT_URI,
      state,
      scope: 'pages_show_list,pages_read_engagement,pages_read_user_content'
    });
    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
  } catch (e) { next(e); }
});

router.get('/api/auth/facebook/callback', async (req, res, next) => {
  try {
    const { state, code } = req.query;
    cleanupStates();
    const st = stateStore.get(state);
    if (!st) return res.status(400).json({ error: 'invalid_state' });
    stateStore.delete(state);

    const tokenParams = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      redirect_uri: process.env.FB_REDIRECT_URI,
      code
    });
    const tokenResp = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
    if (!tokenResp.ok) return res.status(502).json({ error: 'oauth_exchange_failed' });
    const tokenJson = await tokenResp.json();
    const userToken = tokenJson.access_token;

    const pagesResp = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(userToken)}`);
    if (!pagesResp.ok) return res.status(502).json({ error: 'page_fetch_failed' });
    const pagesJson = await pagesResp.json();
    const page = pagesJson.data?.[0];
    if (!page) return res.status(400).json({ error: 'no_pages' });

    const { id: pageId, name, category, access_token: pageToken } = page;
    const { rows: [row] } = await query(
      `INSERT INTO facebook_pages (org_id, page_id, name, category, is_active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (org_id, page_id) DO UPDATE
            SET name=EXCLUDED.name,
                category=EXCLUDED.category,
                is_active=true,
                updated_at=now()
         RETURNING id`,
      [st.orgId, pageId, name, category]
    );

    const enc = encrypt(pageToken);
    await query(
      `INSERT INTO facebook_oauth_tokens (page_id, access_token, enc_ver, scopes)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (page_id) DO UPDATE
            SET access_token=EXCLUDED.access_token,
                enc_ver=EXCLUDED.enc_ver,
                scopes=EXCLUDED.scopes,
                updated_at=now()`,
      [row.id, enc.c, enc.v, ['pages_show_list','pages_read_engagement','pages_read_user_content']]
    );

    const redirectTo = st.returnTo.includes('?') ? `${st.returnTo}&fb_connected=1` : `${st.returnTo}?fb_connected=1`;
    res.redirect(redirectTo);
  } catch (e) { next(e); }
});

export default router;
