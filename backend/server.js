// backend/server.js — unified server (correto)
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
// import healthRouter from './routes/health.js'; // opcional se quiser manter inline
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

// Services & middleware
import { authRequired, impersonationGuard } from './middleware/auth.js';
import uploadsRouter from './routes/uploads.js';
import { initIO } from './socket/io.js';
// ❌ NÃO usar o antigo middleware/arquivo de impersonation aqui
// import { impersonation } from './middleware/impersonation.js';
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
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Health inline ----------
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'cresceja-backend',
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

// Ping simples
app.get('/api/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

// ---------- ROTAS PÚBLICAS (antes do auth) ----------
app.use('/api/webhooks/instagram', igRouter);
app.use('/api/webhooks/messenger', fbRouter);
// Se o metaWebhook precisar assinar payloads, troque por express.raw({type:'application/json'})
app.use('/api/webhooks', /* express.json({ limit: '10mb' }), */ metaWebhookRouter);

app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter); // login não exige token

// ---------- MIDDLEWARES GLOBAIS PROTEGIDOS ----------
app.use(authRequired);        // popula req.user
app.use(impersonationGuard);  // define req.orgId/impersonation
app.use(pgRlsContext);        // abre transação e faz set_config(app.org_id/app.role)

// ---------- ROTAS PROTEGIDAS (RLS ativo via req.db) ----------
app.use('/api/channels', channelsRouter);
app.use('/api/posts', postsRouter);

app.use('/api/lgpd', lgpdRouter);
app.use('/api/crm', crmRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/ai-credits', aiCreditsRouter);
app.use('/api/onboarding', onboardingRouter);      // em /api/onboarding
app.use('/api/conversations', conversationsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/whatsapp-templates', whatsappTemplatesRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/orgs', orgsRouter);                  // dedicado
app.use('/api/inbox', inboxExtraRouter);           // já protegido globalmente

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
initIO(httpServer);

// Raiz simples
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
