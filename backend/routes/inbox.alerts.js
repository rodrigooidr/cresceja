import { Router } from 'express';

const router = Router();

router.get('/alerts', (req, res) => {
  if (!req.org?.id && String(process.env.NODE_ENV) !== 'production') {
    return res.json({ ok: true, items: [] });
  }
  return res.json({ ok: true });
});

router.get('/alerts/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => clearInterval(ping));
});

export default router;
