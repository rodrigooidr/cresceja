import { Router } from 'express';
import crypto from 'crypto';
import { normalizeMessenger, normalizeInstagram } from '../../services/meta/normalizers.js';
import { ingestIncoming } from '../../services/inbox/ingest.js';
import createIntegrationAuditor from '../../services/audit.js';

let ingestFn = ingestIncoming;
export function _setIngestFn(fn) {
  ingestFn = typeof fn === 'function' ? fn : ingestIncoming;
}

function verifySignature(req) {
  const secret = process.env.META_APP_SECRET || '';
  const sig = req.get('X-Hub-Signature-256') || '';
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const hmac = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac));
  } catch {
    return false;
  }
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const clone = JSON.parse(JSON.stringify(payload));
  const scrub = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        scrub(obj[key]);
      }
      if (/token|secret|signature|key/i.test(key)) {
        delete obj[key];
      }
    }
  };
  scrub(clone);
  return clone;
}

async function storeIntegrationEvent(req, provider, payload) {
  const db = req.db;
  if (!db?.query) return;
  const clean = sanitizePayload(payload);
  const orgId = clean?.org_id || clean?.orgId || null;
  try {
    await db.query(
      `INSERT INTO integration_events (org_id, provider, payload, received_at)
       VALUES ($1, $2, $3::jsonb, now())`,
      [orgId, provider, JSON.stringify(clean)]
    );
  } catch (err) {
    req.log?.warn?.({ err, provider }, 'integration_events_store_failed');
  }
}

const router = Router();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/', async (req, res) => {
  if (!verifySignature(req)) return res.sendStatus(401);
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  let body = {};
  try {
    body = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
  } catch {
    body = {};
  }
  const auditor = createIntegrationAuditor({ db: req.db, logger: req.log });
  await auditor(body?.org_id || null, 'meta', 'webhook_receive', 'success', {
    object: body?.object || 'unknown',
  });
  res.sendStatus(200);
  setImmediate(async () => {
    try {
      await storeIntegrationEvent(req, 'meta', body);
      const { object } = body || {};
      let events = [];
      if (object === 'page') events = normalizeMessenger(body);
      if (object === 'instagram') events = normalizeInstagram(body);
      await Promise.all(events.map(ingestFn));
    } catch (err) {
      req.log?.error?.({ err }, 'meta_webhook_process_failed');
    }
  });
});

export default router;
