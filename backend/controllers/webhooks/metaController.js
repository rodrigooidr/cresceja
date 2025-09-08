// backend/controllers/webhooks/metaController.js
import * as wa from '../../services/social/waCloud.js';
import * as igfb from '../../services/social/igfb.js';

export async function verify(req, res) {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  const expected = process.env.META_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === expected) return res.status(200).send(challenge);
  return res.sendStatus(403);
}

export async function receive(req, res) {
  const { provider } = req.params;
  try {
    if (provider === 'whatsapp') {
      await wa.handleWebhook(req.db, req.body);
    } else if (provider === 'instagram' || provider === 'facebook') {
      await igfb.handleWebhook(req.db, provider, req.body);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('[webhook]', provider, e);
    res.sendStatus(200); // responder 200 para evitar retries agressivos; logamos erro
  }
}
