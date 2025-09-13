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
import orgsRouter from './routes/orgs.js';
import orgFeaturesRouter from './routes/orgs.features.js';
import orgWhatsappRouter from './routes/orgs.whatsapp.js';
import orgsCalendarRouter from './routes/orgs.calendar.js';
import channelsRouter from './routes/channels.js';
import postsRouter from './routes/posts.js';
import inboxRoutes from './routes/inbox.js';
import funnelRouter from './routes/crm.funnel.js';
import debugRouter from './routes/debug.js';
import adminOrgsRouter from './routes/admin/orgs.js';
import plansRouter from './routes/plans.js';
import adminPlansFeaturesRouter from './routes/admin/plans.features.js';

// Auth & contexto de RLS
import { authRequired, impersonationGuard } from './middleware/auth.js';
import { pgRlsContext } from './middleware/pgRlsContext.js';
import { requireRole } from './auth/requireRole.js';
import { adminContext } from './middleware/adminContext.js';

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Logger ----------
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

// ---------- Helpers ----------
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function applyCommonHeadersForApi(_req, res, next) {
  // evita cache no /api
  res.set('Cache-Control', 'no-store');
  next();
}

// ============ App factory ============
async function init() {
  // Checagem do banco antes de subir
  try {
    await healthcheck();
    logger.info('DB healthcheck OK');
  } catch (err) {
    logger.error({ err }, 'DB healthcheck FAILED');
    process.exit(1);
  }

  const app = express();

  // Configs base
  app.set('etag', false);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---------- CORS (sempre antes de qualquer rota/middleware que lide com body) ----------
  const ALLOWED_ORIGINS = corsOrigins;
  const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const ALLOWED_HEADERS = [
    'Authorization',
    'Content-Type',
    'X-Org-Id',
    'X-Impersonate-Org-Id',
    'Cache-Control', // <- necessário para seu caso
    'Pragma',
    'Expires',
    'Accept',
    'X-Requested-With',
  ];

  const corsOptions = {
    origin: (origin, cb) => {
      // permite ferramentas como curl/postman (sem origin)
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
  // responde preflight para QUALQUER rota
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
  // Meta (Facebook/Instagram) com assinatura X-Hub-Signature-256 precisa de raw body
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), metaWebhookRouter);
  // Demais webhooks (sem necessidade de raw body)
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
    req.pool = pool; // acesso ao Pool (se algum repo precisar)
    next();
  });

  // ---------- Health público ----------
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'cresceja-backend',
      uptime: process.uptime(),
      time: new Date().toISOString(),
    });
  });
  app.get('/api/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

  // ---------- Rotas públicas ----------
  app.use('/api/public', publicRouter);
  app.use('/api/auth', authRouter); // login é público

  // ---------- Middlewares globais para /api/* protegidas ----------
  app.use('/api', applyCommonHeadersForApi);

  // Rotas de planos (públicas e admin)
  app.use('/api', plansRouter);

  // Rotas administrativas de planos (SuperAdmin/Support)
  app.use('/api/admin/plans', authRequired, requireRole('SuperAdmin','Support'), adminContext, adminPlansFeaturesRouter);

  // Demais rotas administrativas (SuperAdmin)
  app.use('/api/admin', authRequired, requireRole('SuperAdmin'), adminContext, adminOrgsRouter);

  app.use('/api', authRequired, impersonationGuard, pgRlsContext);

  // ---------- Rotas protegidas ----------
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
  app.use('/', orgFeaturesRouter);
  app.use('/', orgWhatsappRouter);
  app.use('/', orgsCalendarRouter);

  // Integrações (rotas base + sub-rotas específicas)
  app.use('/api/integrations', integrationsRouter);                          // ex.: /api/integrations/status
  app.use('/api/integrations/whatsapp/cloud', waCloudIntegrationRouter);     // ex.: /api/integrations/whatsapp/cloud/status
  app.use('/api/integrations/whatsapp/session', waSessionIntegrationRouter); // ex.: /api/integrations/whatsapp/session/status
  app.use('/api/integrations/meta', metaOauthIntegrationRouter);             // ex.: /api/integrations/meta/pages
  app.use('/api', googleCalendarRouter);
  app.use('/api/orgs', orgsRouter);
  app.use('/api', funnelRouter);
  app.use('/api/debug', debugRouter);

  // Inbox (após auth/pgRlsContext)
  app.use('/api/inbox', inboxRoutes);

  // 404 apenas para /api/*
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // ---------- Error handler ----------
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
  /* eslint-enable no-unused-vars */

  // ---------- HTTP + Socket.io ----------
  const httpServer = http.createServer(app);

  const io = new IOServer(httpServer, {
    path: '/socket.io',
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
  });

  // Disponibiliza io para rotas (req.app.get('io'))
  app.set('io', io);

  // Autenticação no handshake do WS (ajuste se usar outro segredo/claim)
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').split(' ')[1];
      if (!token) return next(new Error('no_token'));
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

  // Raiz simples (pública)
  app.get('/', (_req, res) => res.json({ name: 'CresceJá API', status: 'ok' }));

  // ---------- Boot ----------
  const PORT = Number(process.env.PORT || 4000);
  httpServer.listen(PORT, () => logger.info(`CresceJá backend + WS listening on :${PORT}`));

  // ---------- Shutdown gracioso ----------
  const shutdown = async (signal) => {
    try {
      logger.info({ signal }, 'Shutting down…');
      httpServer.close(() => logger.info('HTTP server closed'));
      io.close();
      await pool.end();
      logger.info('DB pool closed');
      process.exit(0);
    } catch (e) {
      logger.error({ e }, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));
}

// Executa
init().catch((e) => {
  // Se algo falhar no init (ex.: DB), encerra com log
  // eslint-disable-next-line no-console
  console.error('Fatal during init:', e);
  process.exit(1);
});
