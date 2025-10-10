import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import { requireAnyRole, requireOrgFeature } from '../../middlewares/auth.js';
import { diagFeatureLog } from '../../middlewares/diagFeatureLog.js';
import whatsappSession from '../integrations/whatsapp.session.js';
import whatsappCloud from '../integrations/whatsapp.cloud.js';
import metaOauthRouter from '../integrations/meta.oauth.js';
import googleCalendarRouter from '../integrations/google.calendar.js';
import { Pool } from 'pg';
import { signQrToken, verifyQrToken } from '../../services/qrToken.js';
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

const requireWhatsAppSessionRole = requireAnyRole(['SuperAdmin', 'OrgOwner']);
const requireWhatsAppSessionFeature = requireOrgFeature('whatsapp_session_enabled');

const issueQrToken = (req, res) => {
  const orgId = req.org?.id || req.orgId || req.headers['x-org-id'];
  const userId = req.user?.id || req.user?.sub || 'unknown';
  if (!orgId) {
    return res.status(400).json({ error: 'invalid_org', message: 'Org ausente' });
  }
  try {
    const token = signQrToken({ userId, orgId, secret: process.env.JWT_SECRET, ttl: 60 });
    return res.json({ token, expires_in: 60 });
  } catch (err) {
    req.log?.error?.({ err }, 'qr-token-sign-failed');
    return res.status(500).json({ error: 'token_sign_failed', message: err.message });
  }
};

const allowQrTokenForStream = (req, res, next) => {
  const token = req.query?.access_token;
  if (!token) {
    return requireWhatsAppSessionRole(req, res, next);
  }
  try {
    const payload = verifyQrToken(String(token), process.env.JWT_SECRET);
    req.user = { ...(req.user || {}), id: payload.sub, sub: payload.sub };
    req.user.roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    req.org = { ...(req.org || {}), id: payload.org_id };
    if (!req.orgId) req.orgId = payload.org_id;
    return next();
  } catch (err) {
    req.log?.warn?.({ err }, 'qr-token-invalid');
    return res.status(401).json({ error: 'unauthorized', message: 'Token QR inválido/expirado' });
  }
};

w.get(
  '/qr/token',
  requireWhatsAppSessionRole,
  diagFeatureLog('whatsapp_session_enabled'),
  requireWhatsAppSessionFeature,
  issueQrToken,
);
w.get(
  '/../../../test-whatsapp/qr/token',
  requireWhatsAppSessionRole,
  diagFeatureLog('whatsapp_session_enabled'),
  requireWhatsAppSessionFeature,
  issueQrToken,
);

w.post('/qr/start', requireWhatsAppSessionRole, requireWhatsAppSessionFeature, (_req, res) =>
  res.json({ ok: true }),
);
w.post('/qr/stop', requireWhatsAppSessionRole, requireWhatsAppSessionFeature, (_req, res) =>
  res.json({ ok: true }),
);
w.get(
  '/qr/stream',
  allowQrTokenForStream,
  diagFeatureLog('whatsapp_session_enabled'),
  requireWhatsAppSessionFeature,
  (req, res) => {
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
  },
);

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
