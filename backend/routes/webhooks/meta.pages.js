import { Router } from 'express';

const router = Router();

// Verificação do webhook
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// Ingestão básica de mensagens
router.post('/', async (req, res) => {
  try {
    // TODO: processar mensagens de Facebook/Instagram
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(200);
  }
});

export default router;
