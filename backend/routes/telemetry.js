import { Router } from 'express';
import * as requireRoleMod from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';

const router = Router();

const requireRole = requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;

function today() {
  return new Date();
}

function formatDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return formatDate(parsed);
}

function ensureRange(query) {
  const now = today();
  const defaultTo = formatDate(now);
  const defaultFrom = formatDate(new Date(now.getTime() - 29 * 24 * 3600 * 1000));
  return {
    from: parseDate(query.from, defaultFrom),
    to: parseDate(query.to, defaultTo),
  };
}

async function ensureOrgAccess(req, orgId) {
  if (!orgId) return false;
  if (!req.user) return false;
  if ([ROLES.SuperAdmin, ROLES.Support].includes(req.user.role)) return true;
  const headerOrg = req.get('X-Impersonate-Org-Id') || req.get('X-Org-Id') || null;
  const currentOrgId = headerOrg || req.user.org_id || req.orgId || null;
  if (!currentOrgId) return false;
  return currentOrgId === orgId;
}

router.get(
  '/api/orgs/:orgId/telemetry/summary',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner),
  async (req, res, next) => {
    const db = req.db;
    const { orgId } = req.params;
    const hasAccess = await ensureOrgAccess(req, orgId);
    if (!hasAccess) return res.status(403).json({ error: 'forbidden_org' });

    try {
      const range = ensureRange(req.query);
      const paramsBase = [orgId, range.from, range.to];

      const messagesPromise = db.query(
        `SELECT COALESCE(COUNT(*), 0)::int AS total
           FROM public.telemetry_events
          WHERE org_id = $1
            AND occurred_at >= $2::date
            AND occurred_at < ($3::date + interval '1 day')
            AND event_key = ANY($4)` ,
        [...paramsBase, ['inbox.message.sent', 'inbox.message.received']]
      );

      const aiPromise = db.query(
        `SELECT COALESCE(COUNT(*), 0)::int AS total
           FROM public.telemetry_events
          WHERE org_id = $1
            AND occurred_at >= $2::date
            AND occurred_at < ($3::date + interval '1 day')
            AND event_key = 'ai.autoreply.sent'`,
        paramsBase
      );

      const handoffPromise = db.query(
        `SELECT COALESCE(COUNT(*), 0)::int AS total
           FROM public.telemetry_events
          WHERE org_id = $1
            AND occurred_at >= $2::date
            AND occurred_at < ($3::date + interval '1 day')
            AND event_key = 'handoff.requested'`,
        paramsBase
      );

      const mttaPromise = db.query(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.handoff_ack_at - c.human_requested_at))), 0)::numeric AS seconds
           FROM public.conversations c
          WHERE c.org_id = $1
            AND c.human_requested_at IS NOT NULL
            AND c.handoff_ack_at IS NOT NULL
            AND c.human_requested_at >= $2::date
            AND c.human_requested_at < ($3::date + interval '1 day')`,
        paramsBase
      );

      const [messages, ai, handoffs, mtta] = await Promise.all([
        messagesPromise,
        aiPromise,
        handoffPromise,
        mttaPromise,
      ]);

      return res.json({
        range,
        cards: {
          messages: messages.rows?.[0]?.total ?? 0,
          ai_autoreplies: ai.rows?.[0]?.total ?? 0,
          handoffs: handoffs.rows?.[0]?.total ?? 0,
          handoff_mtta_seconds: Number(mtta.rows?.[0]?.seconds ?? 0),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/api/orgs/:orgId/telemetry/series',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner),
  async (req, res, next) => {
    const db = req.db;
    const { orgId } = req.params;
    const hasAccess = await ensureOrgAccess(req, orgId);
    if (!hasAccess) return res.status(403).json({ error: 'forbidden_org' });

    try {
      const range = ensureRange(req.query);
      const metric = req.query.metric || 'messages.total';

      let eventKeys = [];
      if (metric === 'messages.total') {
        eventKeys = ['inbox.message.sent', 'inbox.message.received'];
      } else if (metric === 'handoff.count') {
        eventKeys = ['handoff.requested'];
      } else if (metric === 'ai.autoreplies') {
        eventKeys = ['ai.autoreply.sent'];
      }

      if (eventKeys.length === 0) {
        return res.json({ metric, series: [] });
      }

      const { rows } = await db.query(
        `SELECT date_trunc('day', occurred_at)::date AS day,
                COUNT(*)::int AS value
           FROM public.telemetry_events
          WHERE org_id = $1
            AND occurred_at >= $2::date
            AND occurred_at < ($3::date + interval '1 day')
            AND event_key = ANY($4)
          GROUP BY 1
          ORDER BY 1`,
        [orgId, range.from, range.to, eventKeys]
      );

      return res.json({ metric, series: rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
