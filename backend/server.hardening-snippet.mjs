
// Adicione no início do seu server (ESM)
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Segurança HTTP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS restrito (ajuste lista)
const ALLOWED = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({ origin: ALLOWED, credentials: true }));

// Rate limit básico
app.use(rateLimit({ windowMs: 15*60*1000, max: 1000 }));

// Healthchecks
import healthRouter from './backend/routes/health.js';
app.use('/', healthRouter);

// LGPD
import lgpdRouter from './backend/routes/lgpd.js';
app.use('/api/lgpd', lgpdRouter);

// Webhooks IG/Messenger
import igRouter from './backend/routes/webhooks/instagram.js';
import fbRouter from './backend/routes/webhooks/messenger.js';
app.use('/api/webhooks/instagram', igRouter);
app.use('/api/webhooks/messenger', fbRouter);

// WhatsApp templates
import wtplRouter from './backend/routes/whatsapp-templates.js';
app.use('/api/whatsapp/templates', wtplRouter);
