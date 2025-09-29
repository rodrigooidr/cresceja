// backend/server.js — unified server (revisado e padronizado)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

// DB (pool + healthcheck)
import { pool, healthcheck } from '#db';

// Routers públicos e protegidos
import authRouter from './routes/auth.js';
import authGoogleRouter from './routes/auth.google.js';
import authFacebookRouter from './routes/auth.facebook.js';
import authInstagramRouter from './routes/auth.instagram.js';
import publicRouter from './routes/public.js';
import metaWebhookRouter from './routes/webhooks/meta.js';
import igRouter from './routes/webhooks/instagram.js';
import fbRouter from './routes/webhooks/messenger.js';
import waWebhookRouter from './routes/webhooks/whatsapp.js';
import metaPagesWebhookRouter from './routes/webhooks/meta.pages.js';
import uploadsRouter from './routes/uploads.js';
import lgpdRouter from './routes/lgpd.js';
import crmRouter from './routes/crm.js';
import leadsRouter from './routes/leads.js';
import approvalsRouter from './routes/approvalRoutes.js';
import aiCreditsRouter from './routes/aiCreditsRoutes.js';
import onboardingRouter from './routes/onboarding.js';
import conversationsRouter from './routes/conversations.js';
import attachmentsRouter from './routes/attachments.js';
import mediaRoutes from './routes/media.js';
import metaStatusRouter from './routes/channels/meta.status.js';
import reportsRouter from './routes/reports.js';
import subscriptionRouter from './routes/subscription.js';
import whatsappRouter from './routes/whatsapp.js';
import whatsappTemplatesRouter from './routes/whatsapp_templates.js';
import agendaRouter from './routes/agenda_whatsapp.js';
import integrationsRouter from './routes/integrations.js';
import clientsRouter from './routes/clients.js';
import waCloudIntegrationRouter from './routes/integrations/whatsapp.cloud.js';
import waSessionIntegrationRouter from './routes/integrations/whatsapp.session.js';
import metaOauthIntegrationRouter from './routes/integrations/meta.oauth.js';
import googleCalendarRouter from './routes/integrations/google.calendar.js';
import organizationsRouter from './routes/organizations.js';
import orgFeaturesRouter from './routes/orgs.features.js';
import orgWhatsappRouter from './routes/orgs.whatsapp.js';
import orgsCalendarRouter from './routes/orgs.calendar.js';
import orgsFacebookRouter from './routes/orgs.facebook.js';
import orgsFacebookPublishRouter from './routes/orgs.facebook.publish.js';
import orgsFacebookJobsRouter from './routes/orgs.facebook.jobs.js';
import orgsInstagramRouter from './routes/orgs.instagram.js';
import orgsInstagramPublishRouter from './routes/orgs.instagram.publish.js';
import orgsInstagramJobsRouter from './routes/orgs.instagram.jobs.js';
import orgsCampaignsGenerateRouter from './routes/orgs.campaigns.generate.js';
import orgsCampaignsRouter from './routes/orgs.campaigns.js';
import orgsCampaignsApproveRouter from './routes/orgs.campaigns.approve.js';
import orgsAssetsRouter from './routes/orgs.assets.js';
import channelsRouter from './routes/channels.js';
import postsRouter from './routes/posts.js';
import inboxRoutes from './routes/inbox.js';
import inboxSendRoutes from './routes/inbox.send.js';
import metaChannelsRoutes from './routes/channels/meta.js';
import telemetryRouter from './routes/telemetry.js';
import handoffRouter from './routes/conversations.handoff.js';
import inboxCompatRouter from './routes/inbox.compat.js';
import crmCompatRouter from './routes/crm.compat.js';
import aiCompatRouter from './routes/ai.compat.js';
import aiActionsRouter from './routes/ai.actions.js';
import aiProfileRouter from './routes/ai.profile.routes.js';
import aiKbRouter from './routes/ai.kb.routes.js';
import aiTestRouter from './routes/ai.test.routes.js';
import aiViolationsRouter from './routes/ai.violations.routes.js';
import inboxTranscribeRouter from './routes/inbox.transcribe.js';
import crmStatusCompatRouter from './routes/crm.status.compat.js';
import whatsappCompatRouter from './routes/whatsapp.compat.js';
import funnelRouter from './routes/crm.funnel.js';
import debugRouter from './routes/debug.js';
import adminOrgsRouter from './routes/admin/orgs.js';
import adminOrgByIdRouter from './routes/admin/orgById.js';
import plansRouter from './routes/plans.js';
import adminPlansRouter from './routes/admin/plans.js';
import calendarCompatRouter from './routes/calendar.compat.js';
import calendarRemindersRouter from './routes/calendar.reminders.js';
import createCalendarRemindersOneRouter from './routes/calendar.reminders.one.js';
import createAuditLogsRouter from './routes/audit.logs.js';
import calendarRsvpRouter from './routes/calendar.rsvp.js';
import { createHealthRouter } from './routes/health.js';
import noShowRouter, { createNoShowRouter } from './routes/calendar.noshow.js';
import calendarServicesAdminRouter from './routes/calendar.services.admin.js';
import calendarCalendarsAdminRouter from './routes/calendar.calendars.admin.js';
import telemetryAppointmentsRouter from './routes/telemetry.appointments.js';
import telemetryAppointmentsExportRouter from './routes/telemetry.appointments.export.js';
import telemetryAppointmentsFunnelRouter from './routes/telemetry.appointments.funnel.js';
import telemetryAppointmentsFunnelExportRouter from './routes/telemetry.appointments.funnel.export.js';
import { startCampaignsSyncWorker } from './queues/campaigns.sync.worker.js';

// Auth & contexto de RLS
import { authRequired, impersonationGuard } from './middleware/auth.js';
import { pgRlsContext } from './middleware/pgRlsContext.js';

// 🔧 FIX: usar uma única origem para requireRole e ROLES (CommonJS -> ESM interop)
import * as requireRoleModule from './middleware/requireRole.js';
const requireRole =
  requireRoleModule.requireRole ??
  requireRoleModule.default?.requireRole ??
  requireRoleModule.default ??
  requireRoleModule;
const ROLES = requireRoleModule.ROLES ?? requireRoleModule.default?.ROLES ?? requireRoleModule.ROLES;

import { adminContext } from './middleware/adminContext.js';
import { withOrgId } from './middleware/withOrgId.js';
import { startNoShowCron } from './jobs/noshow.sweep.cron.js';
import { resolveDbHealthcheckConfig } from './utils/dbHealthcheckFlag.js';

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Logger ----------
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

export const app = express();

function getDbHealthcheckConfig() {
  return resolveDbHealthcheckConfig(process.env);
}

function logStartupFlags() {
  const dbConfig = getDbHealthcheckConfig();
  logger.info({ dbHealthcheck: dbConfig }, dbConfig.summary);
}

// ---------- Helpers ----------
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000,https://app.cresceja.com.br,https://app.cresceja.com'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function applyCommonHeadersForApi(_req, res, next) {
  // evita cache no /api
  res.set('Cache-Control', 'no-store');
  next();
}

const ALLOWED_ORIGINS = corsOrigins;
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Org-Id',
  'X-Impersonate-Org-Id',
  'Cache-Control',
  'Pragma',
  'Expires',
  'Accept',
  'X-Requested-With',
];

let configured = false;
function configureApp() {
  if (configured) return;
  configured = true;

  // Configs base
  app.set('etag', false);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---------- CORS (sempre antes de qualquer rota/middleware que lide com body) ----------
  const corsOptions = {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      return cb(null, ALLOWED_ORIGINS.includes(origin));
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: ['Content-Disposition'],
    credentials: false,
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '');
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', ALLOWED_METHODS.join(','));
    res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(','));
    res.sendStatus(204);
  });

  // Helmet após CORS para evitar conflitos
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));

  // Logger HTTP
  app.use(pinoHttp({ logger }));

  // Rate limit básico em toda a API
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));

  // ---------- Webhooks (os que exigem RAW vêm antes do express.json) ----------
  app.use('/api/webhooks/meta', express.raw({ type: '*/*' }), metaWebhookRouter);
  app.use('/api/webhooks/instagram', igRouter);
  app.use('/api/webhooks/messenger', fbRouter);
  app.use('/api/webhooks/whatsapp', waWebhookRouter);
  app.use('/api/webhooks/meta-pages', metaPagesWebhookRouter);

  // ---------- Demais rotas com JSON padrão ----------
  app.use(express.json({ limit: '10mb' }));

  // Static público
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/assets', express.static(path.resolve('uploads')));

  // Injeta utilidades por request
  app.use((req, _res, next) => {
    req.pool = pool;
    next();
  });

  // ---------- Health público ----------
  app.use(
    '/api/health',
    createHealthRouter({ healthcheckFn: healthcheck, getDbConfig: getDbHealthcheckConfig })
  );
  app.get('/api/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

  // ---------- Rotas públicas ----------
  app.use('/api/public', publicRouter);
  app.use('/api/auth', authRouter);
  app.use(authGoogleRouter);
  app.use(authFacebookRouter);
  app.use(authInstagramRouter);

  // ---------- Middlewares globais para /api/* protegidas ----------
  app.use('/api', applyCommonHeadersForApi);

  // Rotas de planos (públicas e admin)
  app.use('/api', plansRouter);

  const adminAuthStack = [authRequired, requireRole(ROLES.SuperAdmin, ROLES.Support), adminContext];

  app.use('/api/admin', (req, _res, next) => {
    req.log?.info(
      { trace: 'pre-admin', method: req.method, url: req.originalUrl, params: req.params },
      'incoming admin request',
    );
    next();
  });

  app.use('/api/admin', ...adminAuthStack);

  // Rotas administrativas de planos (SuperAdmin/Support)
  app.use('/api/admin/plans', adminPlansRouter);

  // Rotas administrativas de organizações
  app.use('/api/admin/orgs', adminOrgsRouter);
  app.use('/api/admin/orgs/:orgId', withOrgId, adminOrgByIdRouter);

  // Rotas protegidas exigem auth + guardas de impersonação e contexto RLS
  app.use('/api', authRequired, impersonationGuard, pgRlsContext);

  // Rotas que são factories e precisam de dependências
  const calendarRemindersOneRoute = createCalendarRemindersOneRouter({
    db: pool,
    requireAuth: authRequired,
    requireRole,
    ROLES,
  });

  const auditLogsRouter = createAuditLogsRouter({
    db: pool,
    requireAuth: authRequired,
    requireRole,
    ROLES,
  });

  // ---------- Demais rotas protegidas ----------
  app.use('/api/channels', channelsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/lgpd', lgpdRouter);
  app.use('/api/crm', crmRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/ai-credits', aiCreditsRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/attachments', attachmentsRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/whatsapp-templates', whatsappTemplatesRouter);
  app.use('/api/agenda', agendaRouter);
  app.use('/api', clientsRouter);
  app.use('/api', inboxCompatRouter);
  app.use('/api', crmCompatRouter);
  app.use('/api', aiCompatRouter);
  app.use('/api', aiActionsRouter);
  app.use('/orgs', (req, res) => {
    const target = req.originalUrl.replace(/^\/orgs/, '/organizations');
    return res.redirect(308, target);
  });
  app.use('/', aiProfileRouter);
  app.use('/', aiKbRouter);
  app.use('/', aiTestRouter);
  app.use('/', aiViolationsRouter);
  app.use('/api', inboxTranscribeRouter);
  app.use('/api', crmStatusCompatRouter);
  app.use('/api', whatsappCompatRouter);
  app.use('/', orgFeaturesRouter);
  app.use('/', orgWhatsappRouter);
  app.use('/', orgsCalendarRouter);
  app.use('/', orgsFacebookRouter);
  app.use('/', orgsFacebookPublishRouter);
  app.use('/', orgsFacebookJobsRouter);
  app.use('/', orgsInstagramRouter);
  app.use('/', orgsInstagramPublishRouter);
  app.use('/', orgsInstagramJobsRouter);
  app.use('/', orgsCampaignsGenerateRouter);
  app.use('/', orgsCampaignsRouter);
  app.use('/', orgsCampaignsApproveRouter);
  app.use('/', orgsAssetsRouter);
  app.use('/', telemetryRouter);
  app.use('/', handoffRouter);

  app.use('/api/integrations', integrationsRouter);
  app.use('/api/integrations/whatsapp/cloud', waCloudIntegrationRouter);
  app.use('/api/integrations/whatsapp/session', waSessionIntegrationRouter);
  app.use('/api/integrations/meta', metaOauthIntegrationRouter);
  app.use('/api', googleCalendarRouter);
  app.use('/api', calendarCompatRouter);
  app.use('/api', calendarRsvpRouter);
  const configuredNoShowRouter =
    typeof createNoShowRouter === 'function'
      ? createNoShowRouter({
          db: pool,
          requireAuth: authRequired,
          requireRole,
          ROLES,
        })
      : noShowRouter;
  app.use(configuredNoShowRouter);
  app.use('/api', calendarRemindersRouter);
  app.use(calendarRemindersOneRoute);
  app.use(auditLogsRouter);
  app.use('/api', calendarServicesAdminRouter);
  app.use('/api', calendarCalendarsAdminRouter);
  app.use('/api', telemetryAppointmentsRouter);
  app.use('/api', telemetryAppointmentsExportRouter);
  app.use('/api', telemetryAppointmentsFunnelRouter);
  app.use('/api', telemetryAppointmentsFunnelExportRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/organizations', organizationsRouter);
  app.use('/api/orgs', organizationsRouter);
  app.use('/api', funnelRouter);
  app.use('/api/debug', debugRouter);

  // Rotas legacy baseadas em app
  inboxRoutes(app);
  inboxSendRoutes(app);
  metaChannelsRoutes(app);
  app.use(mediaRoutes);
  app.use(metaStatusRouter);

  // 404 para /api/*
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // Crons de lembretes de calendário (puxa os runners HTTP localmente)
  if (process.env.CALENDAR_REMINDERS_CRON_ENABLED === 'true') {
    const EVERY_MIN = Number(process.env.CALENDAR_REMINDERS_INTERVAL_MIN || 15);
    setInterval(async () => {
      try {
        const base = 'http://127.0.0.1:' + (process.env.PORT || 4000);
        await fetch(base + '/api/calendar/reminders/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: 24 }),
        });
        await fetch(base + '/api/calendar/reminders/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: 1 }),
        });
      } catch (e) {
        // no-op
      }
    }, EVERY_MIN * 60 * 1000);
  }

  // Cron de sweep de no-show (job interno)
  if (process.env.NOSHOW_SWEEP_CRON) {
    startNoShowCron({ db: pool, orgIdResolver: async () => 'system' });
  }

  /* eslint-disable no-unused-vars */
  app.use((err, req, res, _next) => {
    req.log?.error({ err }, 'Unhandled error');
    const status = err.status || 500;
    const payload = { error: 'internal_error' };
    if (process.env.NODE_ENV !== 'production' && err?.message) {
      payload.message = err.message;
    }
    res.status(status).json(payload);
  });
  /* eslint-enable no_UNUSED_VARS */

  app.get('/', (_req, res) => res.json({ name: 'CresceJá API', status: 'ok' }));
}

configureApp();

let httpServer = null;
let io = null;
let started = false;
let shutdownRegistered = false;

async function ensureHealthcheck() {
  const config = getDbHealthcheckConfig();
  if (config.skip) {
    logger.warn('Skipping DB healthcheck (SKIP_DB_HEALTHCHECK enabled)');
    return;
  }
  if (config.reason === 'ignored_in_production' && config.requested) {
    logger.warn('Ignoring SKIP_DB_HEALTHCHECK in production; DB healthcheck required.');
  }
  try {
    await healthcheck();
    logger.info('DB healthcheck OK');
  } catch (err) {
    logger.error({ err }, 'DB healthcheck FAILED');
    throw err;
  }
}

function registerShutdownHooks() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));
}

async function shutdown(signal) {
  try {
    logger.info({ signal }, 'Shutting down…');
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }
    if (io) io.close();
    await pool.end();
    logger.info('DB pool closed');
    process.exit(0);
  } catch (e) {
    logger.error({ e }, 'Error during shutdown');
    process.exit(1);
  }
}

function setupSocketServer() {
  io = new IOServer(httpServer, {
    path: '/socket.io',
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
  });

  app.set('io', io);

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').split(' ')[1];
      if (!token) {
        socket.user = null;
        return next();
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: payload.id, org_id: payload.org_id, role: payload.role };
      return next();
    } catch (e) {
      return next(new Error('bad_token'));
    }
  });

  io.on('connection', (socket) => {
    let currentOrg = socket.user?.org_id || null;
    if (currentOrg) socket.join(`org:${currentOrg}`);

    socket.on('org:switch', ({ orgId }) => {
      if (!orgId) return;
      if (currentOrg) socket.leave(`org:${currentOrg}`);
      currentOrg = orgId;
      socket.join(`org:${currentOrg}`);
    });

    socket.on('inbox:join', ({ room }) => socket.join(room));
    socket.on('inbox:leave', ({ room }) => socket.leave(room));
    socket.on('wa:session:ping', () => socket.emit('wa:session:pong', { ok: true }));
    socket.on('disconnect', () => {});
  });
}

export async function start(options = {}) {
  if (started) return httpServer;

  logStartupFlags();
  await ensureHealthcheck();

  httpServer = http.createServer(app);
  setupSocketServer();

  const requestedPort = options.port ?? process.env.PORT ?? 4000;
  const numericPort =
    typeof requestedPort === 'number' ? requestedPort : Number(requestedPort);
  const port = Number.isFinite(numericPort) && numericPort >= 0 ? numericPort : 4000;
  await new Promise((resolve) => {
    httpServer.listen(port, () => {
      const address = httpServer.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      logger.info(`CresceJá backend + WS listening on :${actualPort}`);
      resolve();
    });
  });

  if (process.env.RUN_WORKERS !== '0' && options.startWorkers !== false) {
    startCampaignsSyncWorker();
  }

  registerShutdownHooks();
  started = true;
  return httpServer;
}

export async function stop() {
  if (!started) return;
  if (io) {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
    app.set('io', null);
  }
  await new Promise((resolve) => {
    if (httpServer) {
      httpServer.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
  httpServer = null;
  io = null;
  started = false;
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Fatal during init:', e);
    process.exit(1);
  });
}

export default app;
