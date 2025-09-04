// backend/server.js — unified server (corrigido)
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

// Routers
import authRouter from './routes/auth.js';
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
import igRouter from './routes/webhooks/instagram.js';
import fbRouter from './routes/webhooks/messenger.js';
import whatsappRouter from './routes/whatsapp.js';
import whatsappTemplatesRouter from './routes/whatsapp_templates.js';
import agendaRouter from './routes/agenda_whatsapp.js';
import integrationsRouter from './routes/integrations.js';
import publicRouter from './routes/public.js';
import orgsRouter from './routes/orgs.js';
import metaWebhookRouter from './routes/webhooks/meta.js';
import inboxExtraRouter from './routes/inboxExtra.js';
import channelsRouter from './routes/channels.js';
import postsRouter from './routes/posts.js';
import inboxRouter from './routes/inbox.conversations.js';
import funnelRouter from './routes/crm.funnel.js';

// Services & middleware
import { authRequired, impersonationGuard } from './middleware/auth.js';
import uploadsRouter from './routes/uploads.js';
import { initIO } from './socket/io.js';
import { pgRlsContext } from './middleware/pgRlsContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Logger ----------
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

// ---------- Express ----------
const app = express();

// desabilita ETag (evita 304 sem corpo em chamadas JSON)
app.set('etag', false);

// força a não usar cache no /api
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---------- CORS (antes de QUALQUER rota) ----------
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.options('*', cors({ origin: corsOrigins, credentials: true })); // preflight
app.use(pinoHttp({ logger }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// ---------- Webhooks ANTES do express.json (Meta precisa raw body) ----------
app.use('/api/webhooks/instagram', igRouter);
app.use('/api/webhooks/messenger', fbRouter);

// Para o webhook do Meta que valida X-Hub-Signature-256:
app.use(
  '/api/webhooks',
  express.raw({ type: 'application/json' }),
  metaWebhookRouter
);

// Agora sim: parser JSON global para o restante da API
app.use(express.json({ limit: '10mb' }));

// Static (público)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Health & Ping (públicos) ----------
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'cresceja-backend',
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});
app.get('/api/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

// ---------- ROTAS PÚBLICAS ----------
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter); // login não exige token

// ---------- MIDDLEWARES GLOBAIS PARA /api/* ----------
app.use('/api', authRequired, impersonationGuard, pgRlsContext);

// ---------- ROTAS PROTEGIDAS ----------
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
app.use('/api/integrations', integrationsRouter);
app.use('/api/orgs', orgsRouter);
app.use('/api', funnelRouter);

// ⚠️ IMPORTANTE: /api/inbox DEPOIS de CORS/JSON/AUTH
app.use('/api', inboxRouter);
app.use('/api/inbox', inboxExtraRouter);

// 404 apenas para /api/*
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// ---------- Error handler ----------
/* eslint-disable no-unused-vars */
app.use((err, req, res, _next) => {
  req.log?.error({ err }, 'Unhandled error');
  const status = err.status || 500;
  const payload = { error: 'internal_error' };
  if (process.env.NODE_ENV !== 'production') payload.message = err.message;
  res.status(status).json(payload);
});
/* eslint-enable no-unused-vars */

// ---------- HTTP + Socket.io ----------
const httpServer = http.createServer(app);

// Passe as mesmas origins para o Socket.io (evita erro de WS)
initIO(httpServer, {
  cors: { origin: corsOrigins, credentials: true },
});

// Raiz simples (pública)
app.get('/', (_req, res) => {
  res.json({ name: 'CresceJá API', status: 'ok' });
});

// Eventos de diagnóstico
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`CresceJá backend + WS listening on :${PORT}`);
});
