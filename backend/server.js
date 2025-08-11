// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import path from 'path';

// Rotas (ESM, cada uma com export default router)
import healthRouter        from './routes/health.js';
import lgpdRouter          from './routes/lgpd.js';
import igRouter            from './routes/webhooks/instagram.js';
import fbRouter            from './routes/webhooks/messenger.js';
import wtplRouter          from './routes/whatsapp_templates.js';

import attachmentsRouter   from './routes/attachments.js';
import leadsImportRouter   from './routes/leads_import.js';
import crmSegmentsRouter   from './routes/crm_segments.js';
import repurposeRouter     from './routes/repurpose.js';
import calGoogleRouter     from './routes/calendar_google.js';
import calOutlookRouter    from './routes/calendar_outlook.js';
import reportsRouter       from './routes/reports.js';

// (Opcional) router agregador. Se não existir, a gente ignora com import dinâmico.
let apiRouter = null;
try {
  const mod = await import('./routes/index.js'); // deve exportar { router }
  apiRouter = mod?.router || null;
} catch { /* sem problemas: arquivo opcional */ }

const app = express();

// Sentry (opcional)
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  app.use(Sentry.Handlers.requestHandler());
}

// Segurança e utilitários
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.set('trust proxy', 1); // atrás do Nginx/Proxy
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// Expor pasta de uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rotas principais
app.use('/', healthRouter);
app.use('/api/lgpd', lgpdRouter);
app.use('/api/whatsapp/templates', wtplRouter);
app.use('/api/webhooks/instagram', igRouter);
app.use('/api/webhooks/messenger', fbRouter);

app.use('/api/attachments', attachmentsRouter);
app.use('/api/leads', leadsImportRouter);
app.use('/api/crm', crmSegmentsRouter);
app.use('/api/repurpose', repurposeRouter);
app.use('/api/calendar/google', calGoogleRouter);
app.use('/api/calendar/outlook', calOutlookRouter);
app.use('/api/reports', reportsRouter);

// (se existir) router agregador
if (apiRouter) app.use('/api', apiRouter);

// Health extra (ping simples)
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Sentry error handler (depois das rotas)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// 404 padrão
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

// Error handler padrão
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: 'internal_error',
    message: err.message || 'Unexpected error',
  });
});

// Start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CresceJá backend listening on :${PORT}`);
});