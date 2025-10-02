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

import { healthcheck } from '#db';

// Rotas (importe SOMENTE as que existem no repo)
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import contentRouter from './routes/content.js';
import inboxCompatRouter from './routes/inbox.compat.js';
import crmCompatRouter from './routes/crm.compat.js';
import aiCompatRouter from './routes/ai.compat.js';
import telemetryRouter from './routes/telemetry.js';
import uploadsRouter from './routes/uploads.js';
import webhooksMetaPages from './routes/webhooks/meta.pages.js';
// Adicione outras rotas **existentes** se necessário.

// Util
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// App
const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(pinoHttp({ logger }));

// Rate limit básico em /api
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

// Montagem de rotas
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/content', contentRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/uploads', uploadsRouter);

// Webhooks
app.use('/api/webhooks/meta/pages', webhooksMetaPages);

// Compat (mantém frontend antigo rodando)
app.use('/api/inbox', inboxCompatRouter);
app.use('/api/crm', crmCompatRouter);
app.use('/api/ai', aiCompatRouter);

// Static (se houver build do frontend)
const clientDir = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(clientDir));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 404 básico da API
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  req.log?.error?.(err);
  res.status(err.status || 500).json({ error: 'internal_error', message: err.message });
});

// Socket.io
let io;
function authFromToken(token) {
  if (!token) return null;
  if (typeof token === 'string' && token.includes(',')) {
    token = token.split(',')[0];
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev_secret';
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
