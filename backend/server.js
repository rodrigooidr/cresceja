// backend/server.js — enhanced (pino, socket.io, zod-ready)
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

// Routers
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import lgpdRouter from './routes/lgpd.js';
import crmRouter from './routes/crm.js';
import leadsRouter from './routes/leads.js';
import approvalsRouter from './routes/approvalRoutes.js';
import aiCreditsRouter from './routes/aiCreditsRoutes.js';
import onboardingRouter from './routes/onboardingRoutes.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' }
});

// Express app
const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api', healthRouter);
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

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  req.log?.error({ err }, 'Unhandled error');
  const status = err.status || 500;
  res.status(status).json({ error: 'internal_error', message: err.message || 'Unexpected error' });
});

// HTTP server + Socket.io
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: corsOrigins, methods: ['GET','POST'], credentials: true }
});

// WS Auth (JWT) + allow-list for WhatsApp test mode
io.use(async (socket, next) => {
  try {
    const auth = socket.handshake?.auth || {};
    let token = auth.token || socket.handshake.headers['authorization'] || '';
    if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7);
    }
    if (!token) throw new Error('missing_token');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    socket.user = { id: payload.sub, role: payload.role };

    // Optional allow-list for WS test (WhatsApp dev mode)
    const allowed = (process.env.ALLOWED_WS_TEST_EMAIL || 'rodrigooidr@hotmail.com').toLowerCase();
    const { rows } = await query('SELECT email FROM public.users WHERE id = $1', [payload.sub]);
    const email = rows?.[0]?.email?.toLowerCase();
    if (!email) throw new Error('user_not_found');
    if (process.env.WS_TEST_MODE === 'true' && email !== allowed) {
      throw new Error('ws_not_allowed');
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

io.on('connection', (socket) => {
  const uid = socket.user?.id;
  socket.join(`user:${uid}`);

  socket.on('ping', () => socket.emit('pong', { t: Date.now() }));

  socket.on('join:conversation', (conversationId) => {
    if (!conversationId) return;
    socket.join(`conv:${conversationId}`);
  });

  socket.on('chat:message', (msg) => {
    if (!msg?.conversationId || !msg?.text) return;
    io.to(`conv:${msg.conversationId}`).emit('chat:message', {
      from: uid, text: msg.text, at: Date.now(), meta: msg.meta || {}
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  logger.info(`CresceJá backend + WS listening on :${PORT}`);
});
