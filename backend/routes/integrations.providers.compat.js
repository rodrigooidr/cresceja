// backend/routes/integrations.providers.compat.js
import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { requireAnyRole } from '../middlewares/auth.js';
import canUseWhatsAppWeb from '../middleware/canUseWhatsAppWeb.js';
import {
  createSession,
  getSessionStatus,
  getSessionQR,
  logoutSessionService,
} from '../services/whatsappSession.js';

export default function providersCompatRouter() {
  const router = express.Router();

  const requireWhatsAppSessionRole = requireAnyRole(['SuperAdmin', 'OrgOwner']);
  router.use(authRequired, requireWhatsAppSessionRole);

  // === WhatsApp Sessão (Baileys) – endpoints esperados pela UI ===
  router.post('/whatsapp_session/connect', canUseWhatsAppWeb, async (req, res, next) => {
    try {
      const io = req.app.get('io') || null;
      await createSession(io);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  router.get('/whatsapp_session/status', canUseWhatsAppWeb, (_req, res) => {
    res.json(getSessionStatus());
  });

  router.get('/whatsapp_session/qr', canUseWhatsAppWeb, (_req, res) => {
    const dataUrl = getSessionQR();
    if (!dataUrl) return res.status(404).json({ error: 'no_qr_available' });
    return res.json({ dataUrl });
  });

  router.post('/whatsapp_session/disconnect', canUseWhatsAppWeb, async (_req, res, next) => {
    try { await logoutSessionService(); res.json({ ok: true }); }
    catch (e) { next(e); }
  });

  return router;
}
