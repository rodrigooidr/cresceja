import { Router } from 'express';

const router = Router();

// Verificação do webhook (Facebook exige echo)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// Ingestão básica (stub)
router.post('/', (req, res) => {
  // Apenas loga e 200 — ajuste depois para enfileirar jobs
  req.log?.info?.({ body: req.body }, 'meta.pages.webhook');
  return res.sendStatus(200);
});

export default router;
