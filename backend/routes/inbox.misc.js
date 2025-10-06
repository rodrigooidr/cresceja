import express from 'express';

const router = express.Router();

router.post('/reads', (req, res) => res.status(204).send());

router.put('/conversations/:id/assume', (req, res) => {
  return res.status(200).json({ conversation: { id: req.params.id, assignee_id: 'me' } });
});

router.put('/conversations/:id/release', (req, res) => {
  return res.status(200).json({ conversation: { id: req.params.id, assignee_id: null } });
});

router.put('/conversations/:id/status', (req, res) => {
  const { status } = req.body || {};
  return res.status(200).json({ conversation: { id: req.params.id, status } });
});

router.get('/tags', (req, res) => res.status(200).json({ tags: ['vip', 'orçamento'] }));

router.post('/conversations/:id/tags', (req, res) => {
  const { tags = [] } = req.body || {};
  return res.status(200).json({ conversation: { id: req.params.id, tags } });
});

router.get('/channels', (req, res) => res.status(200).json({ channels: ['whatsapp', 'instagram', 'facebook', 'email'] }));

router.get('/clients/:id', (req, res) =>
  res.status(200).json({
    id: req.params.id,
    name: 'Cliente',
    email: null,
    phone: null,
    notes: null,
    external_id: null,
  })
);

router.put('/clients/:id', (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  return res.status(200).json({ ...payload, id: req.params.id });
});

export default router;
