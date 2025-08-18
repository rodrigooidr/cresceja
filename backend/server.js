// backend/server.js — robusto (pino, socket.io, stripe raw body, health, 404 só p/ /api/*)
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
import { query } from './config/db.js';

// ---- Routers ----
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';       // mantém, pode ter endpoints extras
import lgpdRouter from './routes/lgpd.js';
import crmRouter from './routes/crm.js';
import leadsRouter from './routes/leads.js';
import approvalsRouter from './routes/approval-routes.js';
import aiCreditsRouter from './routes/ai-credits.js';
import onboardingRouter from './routes/onboarding-routes.js';
import conversationsRouter from './routes/conversations.js';
import attachmentsRouter from './routes/attachments.js';
import reportsRouter from './routes/reports.js';
import subscriptionRouter from './routes/subscription.js';
import igRouter from './routes/webhooks/instagram.js';
import fbRouter from './routes/webhooks/messenger.js';
import whatsappRouter from './routes/whatsapp.js';
import whatsappTemplatesRouter from './routes/whatsapp-templates.js';
import agendaRouter from './routes/agenda-whatsapp.js';
import integrationsRouter from './routes/integrations.js';
import publicRouter from './routes/public.js';
import adminPlansRouter from './routes/admin-plans.js';
import adminClientsRouter from './routes/admin-clients.js';
// PROD: import billingRouter from './routes/billing.js';
import billingRouter from './routes/billing-dev.js';
import webhooksRouter from './routes/webhooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Configs ----------
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'segredo'; // use o MESMO segredo em TODO o backend
const PORT = Number(process.env.PORT || 4000);

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ---------- Logger ----------
const logger = pino({
  level: LOG_LEVEL,
  transport: NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);

// Segurança / CORS primeiro
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));

// Stripe webhook raw body (DEVE vir antes do express.json)
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    // deixa o body bruto disponível p/ verificação de assinatura
    req.rawBody = req.body;
    next();
  }
);

// Demais payloads JSON
app.use(express.json({ limit: '10mb' }));

// Log por request
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      ip: req.ip,
      user: (req.user && req.user.id) || undefined,
    }),
  })
);

// Rate limit global suave (pode ajustar conforme necessidade)
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Health inline confiável ----------
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'cresceja-backend',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    env: NODE_ENV,
  });
});

// Ping simples
app.get('/api/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

// ---------- Rotas ----------
app.use('/api/public', publicRouter);

app.use('/api/admin', adminPlansRouter);   // deve expor /plans, /plans/:id, /plans/:id/publish
app.use('/api/admin', adminClientsRouter);

app.use('/api/billing', billingRouter);
app.use('/api/webhooks', webhooksRouter);  // inclui /webhooks/stripe (recebe rawBody do hook acima)

app.use('/api/auth', authRouter);
// Router dedicado de health (se existir endpoints extras além do GET inline)
app.use('/api/health', healthRouter);

app.use('/api/lgpd', lgpdRouter);
app.use('/api/crm', crmRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/ai-credits', aiCreditsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/webhooks/instagram', igRouter);
app.use('/api/webhooks/messenger', fbRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/whatsapp-templates', whatsappTemplatesRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/integrations', integrationsRouter);

// 404 APENAS para /api/*
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// ---------- Error handler ----------
/* eslint-disable no-unused-vars */
app.use((err, req, res, _next) => {
  req.log?.error({ err }, 'Unhandled error');
  const status = typeof err.status === 'number' ? err.status : 500;
  const payload = { error: 'internal_error' };
  if (NODE_ENV !== 'production') payload.message = err.message;
  res.status(status).json(payload);
});
/* eslint-enable no-unused-vars */

// ---------- HTTP + Socket.io ----------
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: corsOrigins, methods: ['GET', 'POST'], credentials: true },
});

// Disponibiliza io para usar nos handlers
app.set('io', io);

// WS Auth (JWT) + allow-list opcional p/ modo de testes
io.use(async (socket, next) => {
  try {
    const auth = socket.handshake?.auth || {};
    let token =
      auth.token ||
      socket.handshake.headers['authorization'] ||
      '';

    if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7);
    }
    if (!token) throw Object.assign(new Error('missing_token'), { status: 401 });

    // >>> usa o MESMO segredo do resto da API
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.sub || payload.uid || payload.id, role: payload.role };

    // allow-list opcional em modo de teste
    const allowed = (process.env.ALLOWED_WS_TEST_EMAIL || 'rodrigooidr@hotmail.com').toLowerCase();
    const { rows } = await query('SELECT email FROM public.users WHERE id = $1', [socket.user.id]);
    const email = rows?.[0]?.email?.toLowerCase();
    if (!email) throw Object.assign(new Error('user_not_found'), { status: 401 });
    if (process.env.WS_TEST_MODE === 'true' && email !== allowed) {
      throw Object.assign(new Error('ws_not_allowed'), { status: 403 });
    }

    return next();
  } catch (e) {
    return next(e);
  }
});

io.on('connection', (socket) => {
  const uid = socket.user?.id;
  if (uid) socket.join(`user:${uid}`);

  socket.on('ping', () => socket.emit('pong', { t: Date.now() }));

  socket.on('join:conversation', (conversationId) => {
    if (conversationId) socket.join(`conv:${conversationId}`);
  });

  socket.on('chat:message', (msg) => {
    if (!msg?.conversationId || !msg?.text) return;
    io.to(`conv:${msg.conversationId}`).emit('chat:message', {
      from: uid,
      text: msg.text,
      at: Date.now(),
      meta: msg.meta || {},
    });
  });
});

// raiz simples
app.get('/', (_req, res) => {
  res.json({ name: 'CresceJá API', status: 'ok' });
});

// Eventos globais de diagnóstico
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));

server.listen(PORT, () => {
  logger.info(`CresceJá backend + WS listening on :${PORT}`);
});
