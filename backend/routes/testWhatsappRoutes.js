// backend/routes/testWhatsappRoutes.js (ESM)
// Rota de COMPATIBILIDADE para o front legado.
// Mapeia /api/test-whatsapp/* para os serviços atuais.

import express from 'express';
import { authRequired } from '../middleware/auth.js';
import isOwner from '../middleware/isOwner.js';
import canUseWhatsAppWeb from '../middleware/canUseWhatsAppWeb.js';

import {
  createSession,
  getSessionStatus,
  getSessionQR,
  logoutSessionService,
  sendTextMessage,
} from '../services/whatsappSession.js';

import {
  sendWhatsApp as sendViaCloud,
  sendTemplateMeta,
} from '../services/whatsapp.cloud.js';

export default function testWhatsappRouterFactory() {
  const router = express.Router();

  // todas exigem auth + owner; algumas exigem permissão de usar WhatsApp Web
  router.use(authRequired, isOwner);

  // === Sessão (Baileys)
  router.post('/init', canUseWhatsAppWeb, async (req, res, next) => {
    try {
      const io = req.app.get('io') || null;
      await createSession(io);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  router.post('/connect', canUseWhatsAppWeb, async (req, res, next) => {
    try {
      const io = req.app.get('io') || null;
      await createSession(io);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  router.get('/status', canUseWhatsAppWeb, (_req, res) => {
    res.json(getSessionStatus());
  });

  // ⚠️ Compat exata com o que o front está chamando:
  // GET /api/test-whatsapp/qr/token -> { token: "<data:image/png;base64,...>" }
  router.get('/qr/token', canUseWhatsAppWeb, (_req, res) => {
    const dataUrl = getSessionQR();
    if (!dataUrl) return res.status(404).json({ error: 'no_qr_available' });
    return res.json({ token: dataUrl });
  });

  router.post('/logout', canUseWhatsAppWeb, async (_req, res, next) => {
    try { await logoutSessionService(); res.json({ ok: true }); }
    catch (e) { next(e); }
  });

  // === Envio via Cloud API (Meta/Twilio)
  router.post('/send', async (req, res, next) => {
    try {
      const { to, text } = req.body || {};
      if (!to || !text) return res.status(400).json({ error: 'missing_to_or_text' });
      const r = await sendViaCloud(to, text);
      res.json({ ok: true, to, text, response: r });
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

  // (Opcional) enviar via sessão Baileys quando conectada
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
