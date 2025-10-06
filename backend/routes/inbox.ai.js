import { Router } from 'express';

const router = Router();

function safeDraft({ context = [], tone = 'neutro', language = 'pt' } = {}) {
  const lastCustomer = [...context].reverse().find((message) => message?.sender_type === 'customer');
  const base = lastCustomer?.text?.trim() || 'Olá! Como posso ajudar?';
  const prefix = language === 'en' ? 'Draft' : 'Rascunho';
  return `${prefix} (${tone}): ${base}`;
}

function safeSummary({ context = [] } = {}) {
  const recent = context.slice(-8);
  const msgs = recent
    .map((message) => `[${message?.sender_type}] ${message?.text}`)
    .join(' | ');
  return msgs ? `Resumo: ${msgs}` : 'Resumo: (sem mensagens recentes)';
}

function safeClassify({ context = [] } = {}) {
  const text = context.map((message) => message?.text?.toLowerCase() || '').join(' ');
  const tags = [];
  if (text.includes('troca')) tags.push('troca');
  if (text.includes('orçamento') || text.includes('orcamento')) tags.push('orçamento');
  if (text.includes('reclama')) tags.push('reclamação');
  if (text.includes('agendar')) tags.push('agendamento');
  return [...new Set(tags)];
}

router.post('/api/inbox/ai/draft', (req, res) => {
  const { conversation_id, context = [], tone, language } = req.body || {};
  const text = safeDraft({ context, tone, language });
  return res.status(200).json({ conversation_id, text });
});

router.post('/api/inbox/ai/summarize', (req, res) => {
  const { conversation_id, context = [] } = req.body || {};
  const summary = safeSummary({ context });
  return res.status(200).json({ conversation_id, summary });
});

router.post('/api/inbox/ai/classify', (req, res) => {
  const { conversation_id, context = [] } = req.body || {};
  const tags = safeClassify({ context });
  return res.status(200).json({ conversation_id, tags });
});

export default router;
