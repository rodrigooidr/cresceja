import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import whatsappSession from '../integrations/whatsapp.session.js';
import whatsappCloud from '../integrations/whatsapp.cloud.js';
import metaOauthRouter from '../integrations/meta.oauth.js';
import googleCalendarRouter from '../integrations/google.calendar.js';
import { Pool } from 'pg';
// Se/quando houver outros provedores, importe aqui
// import whatsappCloud from '../integrations/whatsapp.cloud.js';

const r = Router();
r.use(authRequired, orgScope);

// Pool Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
});

// -------- Status real (usa view/função SQL) --------
r.get('/status', async (req, res) => {
  try {
    const orgId = req.orgId;
    if (!orgId) return res.status(400).json({ error: 'missing_org', message: 'orgId not resolved' });
    const { rows } = await pool.query(
      'SELECT public.get_integrations_status($1) AS payload',
      [orgId]
    );
    const payload = rows?.[0]?.payload ?? null;
    return res.json(payload ?? { ok: true, whatsapp: [], other: [] });
  } catch (err) {
    req.log?.error?.({ err }, 'integrations-status failed');
    return res.status(500).json({ error: 'integrations_status_failed' });
  }
});

// -------- Events (mantém simples por ora; pode virar leitura de integration_events) --------
r.get('/events', async (_req, res) => {
  return res.json({ ok: true, items: [] });
});

// -------- WhatsApp Session (providers/whatsapp_session) --------
const w = Router();
// mapeia o router existente (whatsapp.session.js) em /providers/whatsapp_session
// ele já implementa: POST /start, GET /status, POST /logout, GET /test
w.use('/', whatsappSession);

// Endpoints QR (SSE) esperados pelo frontend — stubs de compat:
// Caso você já tenha a implementação real do QR, substitua aqui.
w.get('/qr/sse-token', (_req, res) => {
  // Token efêmero; devolvemos algo meramente identificável
  return res.json({ token: 'dev-qr-token' });
});
w.post('/qr/start', (_req, res) => res.json({ ok: true }));
w.post('/qr/stop', (_req, res) => res.json({ ok: true }));
w.get('/qr/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  // Ping de compat
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);
  req.on('close', () => clearInterval(ping));
});

r.use('/providers/whatsapp_session', w);
r.use('/providers/whatsapp-session', w);

// -------- WhatsApp Cloud --------
r.use('/providers/whatsapp_cloud', whatsappCloud);
r.use('/providers/whatsapp-cloud', whatsappCloud);

// -------- Meta OAuth (Instagram & Facebook) --------
r.use('/providers/meta_instagram', metaOauthRouter);
r.use('/providers/meta-instagram', metaOauthRouter);
r.use('/providers/meta_facebook', metaOauthRouter);
r.use('/providers/meta-facebook', metaOauthRouter);

// -------- Google Calendar --------
const googleCalendarProvidersRouter = Router();
googleCalendarProvidersRouter.use((req, _res, next) => {
  req.url = `/integrations/google-calendar${req.url}`;
  next();
});
googleCalendarProvidersRouter.use(googleCalendarRouter);

r.use('/providers/google_calendar', googleCalendarProvidersRouter);
r.use('/providers/google-calendar', googleCalendarProvidersRouter);

export default r;
