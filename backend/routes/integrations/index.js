import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import whatsappSession from '../integrations/whatsapp.session.js';
// Se/quando houver outros provedores, importe aqui
// import whatsappCloud from '../integrations/whatsapp.cloud.js';

const r = Router();
r.use(authRequired, orgScope);

// -------- Status & Events (stubs seguros) --------
// O frontend consome isso para mostrar “dashboard de integrações”
r.get('/status', async (_req, res) => {
  // TODO: ligar com fonte real (DB), por enquanto devolve estrutura válida
  return res.json({ ok: true, items: [] });
});
r.get('/events', async (_req, res) => {
  return res.json({ ok: true, items: [] });
});

// -------- WhatsApp Session (providers/whatsapp_session) --------
const w = Router();
// mapeia o router existente (whatsapp.session.js) em /providers/whatsapp_session
// ele já implementa: POST /start, GET /status, POST /logout, GET /test
w.use('/', whatsappSession);

// Endpoints QR (SSE) esperados pelo frontend — stubs de compat:
// Caso você já tenha a implementação real do QR, substitua aqui.
w.get('/qr/sse-token', (_req, res) => {
  // Token efêmero; devolvemos algo meramente identificável
  return res.json({ token: 'dev-qr-token' });
});
w.post('/qr/start', (_req, res) => res.json({ ok: true }));
w.post('/qr/stop', (_req, res) => res.json({ ok: true }));
w.get('/qr/stream', (req, res) => {
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
});

r.use('/providers/whatsapp_session', w);

export default r;
