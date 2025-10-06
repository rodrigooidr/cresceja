import express from 'express';
import { randomUUID } from 'crypto';

const router = express.Router();

const store = {
  templates: [
    {
      id: 'tmpl-boa-vinda',
      org_id: null,
      name: 'Boas-vindas',
      channel: 'any',
      body: 'Olá {{first_name}}, obrigado por entrar em contato! Como posso ajudar?',
      variables: ['first_name'],
      is_active: true,
      updated_at: new Date().toISOString(),
    },
  ],
};

router.get('/api/inbox/templates', (req, res) => {
  const { org_id } = req.query || {};
  const templates = store.templates.filter(
    (template) => template.is_active && (template.org_id == null || template.org_id === org_id)
  );
  return res.status(200).json({ templates });
});

router.post('/api/inbox/templates', (req, res) => {
  const { org_id, name, channel = 'any', body, variables = [] } = req.body || {};
  const template = {
    id: randomUUID(),
    org_id: org_id || null,
    name,
    channel,
    body,
    variables: Array.isArray(variables) ? variables : [],
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  store.templates.push(template);
  return res.status(201).json({ template });
});

router.put('/api/inbox/templates/:id', (req, res) => {
  const template = store.templates.find((item) => item.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'not_found' });

  const { name, channel, body, variables, is_active } = req.body || {};
  if (name !== undefined) template.name = name;
  if (channel !== undefined) template.channel = channel;
  if (body !== undefined) template.body = body;
  if (variables !== undefined) {
    template.variables = Array.isArray(variables) ? variables : template.variables;
  }
  if (is_active !== undefined) template.is_active = Boolean(is_active);
  template.updated_at = new Date().toISOString();

  return res.status(200).json({ template });
});

router.delete('/api/inbox/templates/:id', (req, res) => {
  const index = store.templates.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'not_found' });
  store.templates.splice(index, 1);
  return res.status(204).send();
});

router.get('/api/inbox/quick-replies', (_req, res) => {
  return res.status(200).json({ items: [] });
});

export default router;
