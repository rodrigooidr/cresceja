import { Router } from 'express';
import crypto from 'crypto';
import { authRequired, impersonationGuard } from '../middleware/auth.js';
import { getFeatureAllowance, getUsage } from '../services/features.js';
import { query } from '#db';
import { saveTokens } from '../services/calendar/googleTokens.js';

const router = Router();

// simple in-memory state store with TTL
const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function setOrgId(req, _res, next) {
  const impersonate = req.get('X-Impersonate-Org-Id');
  if (impersonate) {
    req.orgId = impersonate;
  } else if (req.query.orgId) {
    req.orgId = String(req.query.orgId);
  } else if (req.user?.org_id) {
    req.orgId = req.user.org_id;
  }
  next();
}

function cleanupStates() {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (v.createdAt + STATE_TTL_MS < now) stateStore.delete(k);
  }
}

router.get('/api/auth/google/start', authRequired, impersonationGuard, setOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId;
    const allowed = ['/settings', '/calendar'];
    const rt = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/settings';
    let pathname;
    try {
      pathname = new URL(rt, 'http://localhost').pathname;
    } catch {
      pathname = '/settings';
    }
    const returnTo = allowed.includes(pathname) ? pathname : '/settings';

    const allow = await getFeatureAllowance(orgId, 'google_calendar_accounts', req.db);
    if (!allow.enabled || allow.limit === 0) {
      return res.status(403).json({ error: 'feature_disabled' });
    }
    const used = await getUsage(orgId, 'google_calendar_accounts', req.db);
    if (Number.isInteger(allow.limit) && used >= allow.limit) {
      return res.status(403).json({ error: 'feature_limit_reached', used, limit: allow.limit });
    }

    const state = crypto.randomUUID();
    cleanupStates();
    stateStore.set(state, { orgId, returnTo, createdAt: Date.now() });

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes.join(' '),
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (e) {
    next(e);
  }
});

router.get('/api/auth/google/callback', async (req, res, next) => {
  try {
    const { state, code } = req.query;
    cleanupStates();
    const st = stateStore.get(state);
    if (!st) return res.status(400).json({ error: 'invalid_state' });
    stateStore.delete(state);

    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
    });
    let tokens;
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!r.ok) throw new Error('token');
      tokens = await r.json();
    } catch {
      return res.status(502).json({ error: 'oauth_exchange_failed' });
    }
    const rInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
    });
    const info = await rInfo.json();

    const { rows: [acc] } = await query(
      `INSERT INTO google_calendar_accounts (org_id, google_user_id, email, display_name, is_active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (org_id, google_user_id) DO UPDATE
            SET email=EXCLUDED.email,
                display_name=EXCLUDED.display_name,
                is_active=true,
                updated_at=now()
         RETURNING id`,
      [st.orgId, info.id, info.email, info.name]
    );

    const scopes = (tokens.scope || '').split(' ').filter(Boolean);
    await saveTokens(req.db, acc.id, { ...tokens, scopes });

    const redirectTo = st.returnTo.includes('?') ? `${st.returnTo}&connected=1` : `${st.returnTo}?connected=1`;
    res.redirect(redirectTo);
  } catch (e) { next(e); }
});

export default router;
