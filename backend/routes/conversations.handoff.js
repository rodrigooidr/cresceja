import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';
import { logTelemetry } from '../services/telemetryService.js';

const router = Router();

async function currentOrgId(db) {
  const { rows } = await db.query(`SELECT current_setting('app.org_id', true) AS org_id`);
  return rows?.[0]?.org_id || null;
}

router.post(
  '/api/conversations/:id/handoff',
  requireRole(ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner),
  async (req, res, next) => {
    const db = req.db;
    const { id } = req.params;
    try {
      const orgId = (await currentOrgId(db)) || req.user?.org_id || null;
      if (!orgId) return res.status(401).json({ error: 'missing_org' });

      await db.query(
        `UPDATE public.conversations
            SET human_requested_at = COALESCE(human_requested_at, now()),
                ai_enabled = FALSE
          WHERE id = $1 AND org_id = $2`,
        [id, orgId]
      );

      await logTelemetry(db, {
        orgId,
        userId: req.user?.id || null,
        source: 'handoff',
        eventKey: 'handoff.requested',
      });

      const io = req.app.get('io');
      io?.to(`org:${orgId}`).emit('conversation:handoff', {
        conversationId: id,
        orgId,
      });

      return res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/api/conversations/:id/handoff/ack',
  requireRole(ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner),
  async (req, res, next) => {
    const db = req.db;
    const { id } = req.params;
    try {
      const orgId = (await currentOrgId(db)) || req.user?.org_id || null;
      if (!orgId) return res.status(401).json({ error: 'missing_org' });

      await db.query(
        `UPDATE public.conversations
            SET alert_sent = TRUE,
                handoff_ack_at = now(),
                handoff_ack_by = $3
          WHERE id = $1 AND org_id = $2`,
        [id, orgId, req.user?.id || null]
      );

      await logTelemetry(db, {
        orgId,
        userId: req.user?.id || null,
        source: 'handoff',
        eventKey: 'handoff.acknowledged',
      });

      const io = req.app.get('io');
      io?.to(`org:${orgId}`).emit('conversation:update', {
        conversationId: id,
        alert_sent: true,
      });

      return res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/api/conversations/:id/ai/disable',
  requireRole(ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner),
  async (req, res, next) => {
    const db = req.db;
    const { id } = req.params;
    try {
      const orgId = (await currentOrgId(db)) || req.user?.org_id || null;
      if (!orgId) return res.status(401).json({ error: 'missing_org' });

      await db.query(
        `UPDATE public.conversations SET ai_enabled = FALSE
          WHERE id = $1 AND org_id = $2`,
        [id, orgId]
      );

      await logTelemetry(db, {
        orgId,
        userId: req.user?.id || null,
        source: 'ai',
        eventKey: 'ai.disabled.by_agent',
      });

      const io = req.app.get('io');
      io?.to(`org:${orgId}`).emit('conversation:update', {
        conversationId: id,
        ai_enabled: false,
      });

      return res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/api/conversations/:id/ai/enable',
  requireRole(ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner),
  async (req, res, next) => {
    const db = req.db;
    const { id } = req.params;
    try {
      const orgId = (await currentOrgId(db)) || req.user?.org_id || null;
      if (!orgId) return res.status(401).json({ error: 'missing_org' });

      await db.query(
        `UPDATE public.conversations SET ai_enabled = TRUE
          WHERE id = $1 AND org_id = $2`,
        [id, orgId]
      );

      await logTelemetry(db, {
        orgId,
        userId: req.user?.id || null,
        source: 'ai',
        eventKey: 'ai.reenabled.by_agent',
      });

      const io = req.app.get('io');
      io?.to(`org:${orgId}`).emit('conversation:update', {
        conversationId: id,
        ai_enabled: true,
      });

      return res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
