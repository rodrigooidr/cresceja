import { Router } from 'express';
import crypto from 'crypto';
import { normalizeMessenger, normalizeInstagram } from '../../services/meta/normalizers.js';
import { ingestIncoming } from '../../services/inbox/ingest.js';

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
  const body = (() => {
    try {
      return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body);
    } catch {
      return {};
    }
  })();
  const { object } = body || {};
  let events = [];
  if (object === 'page') events = normalizeMessenger(body);
  if (object === 'instagram') events = normalizeInstagram(body);
  await Promise.all(events.map(ingestFn));
  return res.sendStatus(200);
});

export default router;
