import express from 'express';

const r = express.Router();
r.use(express.json());

// GET verification
r.get('/', (req, res) => {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (token && challenge && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST webhook events
r.post('/', (req, res) => {
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const statuses = change.value?.statuses || [];
        for (const s of statuses) {
          const map = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
          const status = map[s.status] || 'sent';
          // placeholder: aqui poderíamos atualizar mensagens no BD
          req.app?.get('logger')?.info?.({ id: s.id, status }, 'wa status');
        }
      }
    }
  } catch (e) {
    req.log?.error?.({ e }, 'wa webhook error');
  }
  res.sendStatus(200);
});

export default r;
