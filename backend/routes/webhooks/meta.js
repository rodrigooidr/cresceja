// backend/routes/webhooks/meta.js
import { Router } from 'express';
import crypto from 'crypto';
import * as ctrl from '../../controllers/webhooks/metaController.js';

const r = Router();

// Verificação do webhook (GET hub.*)
r.get('/meta/:provider', ctrl.verify);   // :provider = 'whatsapp' | 'instagram' | 'facebook'

// Middleware: verifica X-Hub-Signature-256 e parseia body JSON
function verifySignature(req, res, next) {
  try {
    const signature = req.get('x-hub-signature-256');
    const secret = process.env.META_APP_SECRET || '';
    if (!signature || !secret) return res.sendStatus(401);
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (signature !== expected) return res.sendStatus(401);
    // Após validar, parseia JSON
    req.body = JSON.parse(req.body.toString('utf8') || '{}');
    return next();
  } catch (e) {
    return res.sendStatus(400);
  }
}

// Recebimento de eventos (POST)
r.post('/meta/:provider', verifySignature, ctrl.receive);

export default r;
