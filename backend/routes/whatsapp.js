// backend/routes/whatsapp.js
import express from 'express';
import { authRequired } from '../middleware/auth.js';
import isOwner from '../middleware/isOwner.js';
import canUseWhatsAppWeb from '../middleware/canUseWhatsAppWeb.js';

import {
  createSession,
  getSessionStatus,
  getSessionQR,
  logoutSessionService,
  sendTextMessage, // opcional: enviar via Baileys (contato já aberto)
} from '../services/whatsappSession.js';

import {
  sendWhatsApp as sendViaCloud,
  sendTemplateMeta,
} from '../services/whatsapp.cloud.js';

export default function whatsappRouterFactory(getIO) {
  const router = express.Router();

  router.use(authRequired, isOwner);

  // ---- Sessão Baileys (WhatsApp Web)
  router.post('/session/start', canUseWhatsAppWeb, async (req, res, next) => {
    try {
      const io = typeof getIO === 'function' ? getIO() : null;
      await createSession(io);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  router.get('/session/status', canUseWhatsAppWeb, (_req, res) => {
    res.json(getSessionStatus());
  });

  router.get('/session/qr', canUseWhatsAppWeb, (_req, res) => {
    const dataUrl = getSessionQR();
    if (!dataUrl) return res.status(404).json({ error: 'no_qr_available' });
    res.json({ dataUrl });
  });

  router.post('/logout', canUseWhatsAppWeb, async (_req, res, next) => {
    try { await logoutSessionService(); res.json({ ok: true }); }
    catch (e) { next(e); }
  });

  // ---- Envio via Cloud API (Meta) ou Twilio
  router.post('/send', async (req, res, next) => {
    try {
      const { to, text } = req.body || {};
      if (!to || !text) return res.status(400).json({ error: 'missing_to_or_text' });
      const r = await sendViaCloud(to, text);
      res.json({ ok: true, to, text, provider: process.env.WHATSAPP_PROVIDER || 'meta', response: r });
    } catch (e) { next(e); }
  });

  // Template (Meta HSM)
  router.post('/send-template', async (req, res, next) => {
    try {
      const { to, templateName, languageCode, components } = req.body || {};
      if (!to || !templateName) return res.status(400).json({ error: 'missing_to_or_template' });
      const r = await sendTemplateMeta(to, templateName, languageCode || 'pt_BR', components || []);
      res.json({ ok: true, to, templateName, response: r });
    } catch (e) { next(e); }
  });

  // (Opcional) enviar via Baileys (quando sessão conectada)
  router.post('/send-via-session', canUseWhatsAppWeb, async (req, res, next) => {
    try {
      const { to, text } = req.body || {};
      if (!to || !text) return res.status(400).json({ error: 'missing_to_or_text' });
      const r = await sendTextMessage(to, text);
      res.json({ ok: true, to, text, id: r?.key?.id });
    } catch (e) { next(e); }
  });

  return router;
}
