// backend/controllers/testWhatsappController.js
import {
  createSession,
  getSessionStatus as svcGetStatus,
  getSessionQR,
  logoutSessionService,
  sendTextMessage,
} from '../services/whatsappSession.js';

export async function initSession(req, res, next) {
  try {
    const io = req.app.get('io') || null;
    await createSession(io);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export function getSessionStatus(req, res) {
  const includeQR = String(req.query.includeQR || '').toLowerCase() === 'true';
  const status = svcGetStatus();
  const payload = includeQR ? { ...status, qr: getSessionQR() } : status;
  return res.json(payload);
}

export async function logoutSession(req, res, next) {
  try {
    await logoutSessionService();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { to, text } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'missing_to_or_text' });
    const r = await sendTextMessage(to, text);
    return res.json({ ok: true, to, text, id: r?.key?.id });
  } catch (err) {
    return next(err);
  }
}

export async function sendTestMessage(req, res, next) {
  try {
    const to = req.body?.to || process.env.WHATSAPP_TEST_NUMBER;
    const text = req.body?.text || 'Teste CresceJá OK ✅';
    if (!to) return res.status(400).json({ error: 'missing_test_number' });
    const r = await sendTextMessage(to, text);
    return res.json({ ok: true, to, text, id: r?.key?.id });
  } catch (err) {
    return next(err);
  }
}

/**
 * Endpoint auxiliar para testes manuais de recepção (mock).
 * Em produção, preferir o listener messages.upsert no service.
 */
export async function receiveMessage(req, res) {
  // Apenas confirma o recebimento do payload de teste
  return res.json({ ok: true, received: req.body || {} });
}
