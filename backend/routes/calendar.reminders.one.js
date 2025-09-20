import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import express from 'express';
import { pool } from '#db';
import * as authModule from '../middleware/auth.js';
import * as requireRoleMod from '../middleware/requireRole.js';
import { ROLES as DefaultRoles } from '../lib/permissions.js';
import { sendWhatsApp, ProviderNotConfigured } from '../services/messaging.js';
import { auditLog } from '../services/audit.js';

const schemaParams = z.object({ id: z.string().min(1) });
const schemaBody = z.object({
  to: z.string().min(5),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  text: z.string().min(1).default('Lembrete do seu agendamento.'),
});

function resolveAuth(requireAuth) {
  return (
    requireAuth ||
    authModule?.requireAuth ||
    authModule?.authRequired ||
    authModule?.default ||
    ((_req, _res, next) => next())
  );
}

function resolveRole(requireRole, roles) {
  const defaultRequireRole =
    requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;
  const factory = typeof requireRole === 'function' ? requireRole : defaultRequireRole;
  const superAdmin = roles?.SuperAdmin ?? 'SuperAdmin';
  const orgAdmin = roles?.OrgAdmin ?? 'OrgAdmin';
  return factory(superAdmin, orgAdmin);
}

function resolveDb(req, db) {
  if (req?.db && typeof req.db.query === 'function') return req.db;
  return db && typeof db.query === 'function' ? db : pool;
}

function createLimiter() {
  const parsed = parseInt(process.env.REMIND_RATE_LIMIT_PER_MINUTE || '30', 10);
  const limitPerMinute = Number.isFinite(parsed) ? parsed : 30;
  return rateLimit({
    windowMs: 60 * 1000,
    limit: limitPerMinute,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.user?.orgId ?? req.user?.org_id ?? 'anon'}:${req.ip}`,
    handler: (_req, res) => {
      res.status(429).json({ error: 'RATE_LIMIT', retryAfterSec: 60 });
    },
  });
}

export default function createCalendarRemindersOneRouter({ db = pool, requireAuth, requireRole, ROLES } = {}) {
  const router = express.Router();
  const authMiddleware = resolveAuth(requireAuth);
  const roles = { ...DefaultRoles, ...(ROLES || {}) };
  const roleMiddleware = resolveRole(requireRole, roles);
  const limiter = createLimiter();

  router.post(
    '/api/calendar/events/:id/remind',
    authMiddleware,
    roleMiddleware,
    limiter,
    async (req, res, next) => {
      try {
        const { id } = schemaParams.parse(req.params);
        const { to, channel, text } = schemaBody.parse(req.body || {});
        const windowMin = parseInt(process.env.REMIND_DEDUP_WINDOW_MIN || '10', 10);
        const database = resolveDb(req, db);
        if (!database || typeof database.query !== 'function') {
          throw new Error('database client not available');
        }

        const bucket = Math.floor(Date.now() / (1000 * 60 * Math.max(windowMin, 1)));
        const hash = crypto
          .createHash('sha256')
          .update(`${id}|${channel}|${to}|${bucket}`)
          .digest('hex');

        try {
          await database.query(
            `INSERT INTO reminder_logs (event_id, channel, recipient, hash) VALUES ($1,$2,$3,$4)`,
            [id, channel, to, hash]
          );
        } catch (err) {
          if (err && err.code === '23505') {
            return res.status(200).json({ idempotent: true });
          }
          throw err;
        }

        let providerResp = null;
        try {
          if (channel === 'whatsapp') {
            providerResp = await sendWhatsApp(to, text, { db: database, req });
          } else {
            providerResp = { provider_message_id: 'noop' };
          }
        } catch (err) {
          if (err instanceof ProviderNotConfigured || err?.code === 'WHATSAPP_NOT_CONFIGURED') {
            return res.status(424).json({ error: 'WHATSAPP_NOT_CONFIGURED' });
          }
          throw err;
        }

        const orgId = req.user?.orgId ?? req.user?.org_id ?? req.orgId ?? null;
        const userId = req.user?.id ?? req.user?.user_id ?? null;

        await auditLog(database, {
          orgId,
          userId,
          action: 'calendar.remind.sent',
          entity: 'calendar_event',
          entityId: id,
          payload: {
            channel,
            to,
            provider_message_id: providerResp?.provider_message_id ?? null,
          },
        });

        return res.status(200).json({ idempotent: false, ok: true });
      } catch (err) {
        return next(err);
      }
    }
  );

  return router;
}
