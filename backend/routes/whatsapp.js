import express from 'express';
import { start, status as getStatus, getQR } from '../services/whatsappSession.js';

export default function whatsappRouterFactory(io) {
  const router = express.Router();

  router.post('/session/start', async (req, res) => {
    const activeIO = io ?? req.app.get('io');
    await start(activeIO);
    res.json({ ok: true });
  });

  router.get('/session/status', (_req, res) => {
    res.json(getStatus());
  });

  router.get('/session/qr', (req, res) => {
    const qr = getQR();
    if (!qr) return res.status(404).json({ error: 'no_qr_available' });
    return res.json({ dataUrl: qr });
  });

  return router;
}
