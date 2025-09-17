import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.use(requireAuth);

router.get('/ai/settings', async (req, res, next) => {
  try {
    const orgId = req.user?.org_id || req.get('X-Org-Id');
    if (!orgId) {
      return res.status(400).json({ error: 'org_required' });
    }
    const { rows } = await query(
      `SELECT ai_enabled AS enabled FROM public.org_ai_settings WHERE org_id = $1`,
      [orgId]
    );
    res.json({ enabledAll: rows[0]?.enabled ?? true });
  } catch (err) {
    next(err);
  }
});

router.post('/ai/settings', async (req, res, next) => {
  try {
    const orgId = req.user?.org_id || req.get('X-Org-Id');
    if (!orgId) {
      return res.status(400).json({ error: 'org_required' });
    }
    const enabled = !!req.body?.enabledAll;
    await query(
      `
        INSERT INTO public.org_ai_settings (org_id, ai_enabled, enabled, collect_fields, created_at, updated_at)
        VALUES ($1, $2, $2, '{}'::jsonb, now(), now())
        ON CONFLICT (org_id)
        DO UPDATE SET ai_enabled = EXCLUDED.ai_enabled, enabled = EXCLUDED.enabled, updated_at = now()
      `,
      [orgId, enabled]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/ai/perChat', async (req, res, next) => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) {
      return res.status(400).json({ error: 'conversation_required' });
    }
    const { rows } = await query(
      `SELECT ai_enabled FROM public.conversations WHERE id = $1`,
      [conversationId]
    );
    res.json({ enabled: rows[0]?.ai_enabled ?? null });
  } catch (err) {
    next(err);
  }
});

router.post('/ai/perChat', async (req, res, next) => {
  try {
    const { conversationId, enabled } = req.body ?? {};
    if (!conversationId) {
      return res.status(400).json({ error: 'conversation_required' });
    }
    await query(
      `UPDATE public.conversations SET ai_enabled = $2, updated_at = now() WHERE id = $1`,
      [conversationId, !!enabled]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
