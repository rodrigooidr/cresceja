// backend/server.js — servidor unificado (Express + Socket.io), ESM
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
import cookieParser from 'cookie-parser';

import auth from './middleware/auth.js';
import withOrg from './middleware/withOrg.js';
import orgContext from './middleware/orgContext.js';

import { healthcheck } from '#db';

// Rotas (somente as existentes no repo)
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import contentRouter from './routes/content.js';
import inboxCompatRouter from './routes/inbox.compat.js';
import crmCompatRouter from './routes/crm.contact.js';
import aiCompatRouter from './routes/ai.compat.js';
import telemetryRouter from './routes/telemetry.js';
import uploadsRouter from './routes/uploads.js';
import webhooksMetaPages from './routes/webhooks/meta.pages.js';
import organizationsRouter from './routes/organizations.js';
import orgFeaturesRouter from './routes/org.features.js';
import orgsFeaturesRouter from './routes/orgs.features.js';
import inboxTemplatesRouter from './routes/inbox.templates.js';
import inboxAiRouter from './routes/inbox.ai.js';
import inboxAlertsRouter from './routes/inbox.alerts.js';
import inboxSettingsRouter from './routes/inbox.settings.js';
import inboxConversationsRouter from './routes/inbox.conversations.js';
import inboxMessagesRouter from './routes/inbox.messages.js';
import inboxMiscRouter from './routes/inbox.misc.js';
import inboxUploadsRouter from './routes/inbox.uploads.js';
import aiSettingsRouter from './routes/ai.settings.js';
import aiCreditsStatusRouter from './routes/ai.credits.status.js';
import integrationsRouter from './routes/integrations/index.js';
import gcalRouter from './routes/integrations/google.calendar.js';
import appointmentsOauthRouter from './routes/appointments.oauth.js';
import appointmentsAvailabilityRouter from './routes/appointments.availability.js';
import appointmentsCoreRouter from './routes/appointments.core.js';
import debugRouter from './routes/debug.js';
import adminApp from './app.js';
import calendarCompatRouter from './routes/calendar.compat.js';
import testWhatsappRouter from './routes/testWhatsappRoutes.js';
import onboardingRouter from './routes/onboarding.js';
import adminOrgsRouter from './routes/admin/orgs.js';
import orgsRouter from './routes/orgs.js';

// Util
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// App
const app = express();
if (process.env.NODE_ENV !== 'production') {
  const mask = (s) => (s ? String(s).slice(0, 3) + '***' : '(unset)');
  console.log('[BOOT] NODE_ENV=', process.env.NODE_ENV, ' JWT_SECRET=', mask(process.env.JWT_SECRET));
}

function makePinoConfig() {
  const level = process.env.LOG_LEVEL || 'info';
  const pretty = process.env.LOG_PRETTY === '1' || process.env.NODE_ENV !== 'production';
  return pretty
    ? { level, transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'SYS:HH:MM:ss' } } }
    : { level };
}

let logger;
try {
  logger = pino(makePinoConfig());
} catch (err) {
  if (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.code === 'MODULE_NOT_FOUND' || /pino-pretty/i.test(err?.message || '')) {
    console.warn('[LOG] pino-pretty indisponível; usando logger básico.');
    logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  } else {
    throw err;
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(pinoHttp({ logger }));
app.use(cookieParser());

// Rate limit básico somente em /api
const limiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
});
app.use('/api', limiter);

// Health
app.get('/health', async (req, res) => {
  try {
    const db = await healthcheck();
    return res.json({ ok: true, db });
  } catch (e) {
    req.log?.error?.(e);
    return res.status(500).json({ ok: false, error: 'health_failed' });
  }
});

// ==== Rotas públicas / sem auth
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/webhooks/meta/pages', webhooksMetaPages);

// ==== A partir daqui: exige autenticação
app.use('/api', auth);

// Contexto de organização (lê X-Org-Id / token e injeta em req.org)
app.use('/api', orgContext);

// Endpoints de /api/orgs que não precisam de withOrg (ex: current, list, select)
app.use('/api/orgs', orgsRouter);
app.use(orgFeaturesRouter);

// Se a rota exigir dados da organização ativa, garanta withOrg
app.use('/api', withOrg);

// ==== Rotas autenticadas (com org quando necessário)
app.use('/api/content', contentRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/uploads', uploadsRouter);

// inbox
app.use('/api/inbox', inboxAlertsRouter);
app.use('/api/inbox', inboxSettingsRouter);
app.use(inboxTemplatesRouter);
app.use('/api/inbox', inboxConversationsRouter);
app.use('/api/inbox', inboxMessagesRouter);
app.use('/api/inbox', inboxMiscRouter);
app.use('/api/inbox', inboxUploadsRouter);
app.use(inboxAiRouter);

// org features & ai
app.use('/api/orgs', orgsFeaturesRouter);
app.use('/api/ai', aiSettingsRouter);
app.use('/api/ai-credits', aiCreditsStatusRouter);

// integrações e outros módulos
app.use('/api/integrations', integrationsRouter);
app.use(gcalRouter);
app.use(appointmentsOauthRouter);
app.use(appointmentsAvailabilityRouter);
app.use(appointmentsCoreRouter);
app.use('/api/calendar', calendarCompatRouter);
app.use('/api/test-whatsapp', testWhatsappRouter);
app.use('/api/onboarding', onboardingRouter);

// ==== Rotas admin autenticadas
app.use('/api/admin/orgs', adminOrgsRouter);

// Compat (mantém frontend antigo rodando)
app.use('/api', inboxCompatRouter);
app.use('/api', crmCompatRouter);
app.use('/api', aiCompatRouter);

// Admin (/api/admin/*) legacy app
app.use(adminApp);

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRouter);
}

// Static do frontend
const clientDir = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(clientDir));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 404 da API (deixe por último entre as rotas /api)
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Fallback SPA (qualquer rota não-API volta pro index.html)
app.get(/^(?!\/api\/).+$/, (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  req.log?.error?.(err);
  res.status(err.status || 500).json({ error: 'internal_error', message: err.message });
});

// ===== Socket.io =====
let io;
function authFromToken(token) {
  if (!token) return null;
  if (typeof token === 'string' && token.includes(',')) token = token.split(',')[0];
  try {
    const secret = process.env.JWT_SECRET || 'dev-change-me';
    return jwt.verify(String(token || '').replace(/^Bearer\s+/i, '').trim(), secret);
  } catch {
    return null;
  }
}

function startSockets(server) {
  io = new IOServer(server, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    cors: { origin: true, credentials: true },
  });
  app.set('io', io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const user = authFromToken(token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    return next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(`user:${user.id}`);
    socket.emit('connected', { ok: true });

    socket.on('org:switch', ({ orgId }) => {
      try {
        for (const room of socket.rooms) {
          if (String(room).startsWith('org:')) socket.leave(room);
        }
        if (orgId) socket.join(`org:${orgId}`);
      } catch {}
    });

    socket.on('disconnect', () => {
      // noop
    });
  });

  return io;
}

// Bootstrap http + sockets
let httpServer;
let started = false;

export async function start() {
  if (started) return { httpServer, io };
  const port = Number(process.env.PORT || 4000);
  httpServer = http.createServer(app);
  startSockets(httpServer);
  await new Promise((resolve) => httpServer.listen(port, resolve));
  logger.info({ port }, 'Server started');
  started = true;
  return { httpServer, io };
}

export async function stop() {
  if (!started) return;
  await new Promise((resolve) => httpServer.close(resolve));
  io?.close();
  app.set('io', null);
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
