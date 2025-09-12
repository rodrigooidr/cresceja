
import OpenAI from 'openai';
import { query } from '#db';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const tones = {
  whatsapp: 'próximo e casual, direto, claro e com toques de humor leve',
  instagram: 'visual e leve, frases curtas e emojis ocasionais',
  facebook: 'mais formal e estruturado, com passos e bullets quando útil'
};

export async function aiReply({ channel_type='whatsapp', history=[], companyProfile={} }){
  if (!openai) return { text: 'Olá! Me conte como posso ajudar 😊', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };

  const sys = `Você é um atendente simpático da empresa ${companyProfile.name || 'CresceJá'}. 
Tom: ${tones[channel_type]}. Sempre peça nome e forma de contato quando apropriado (com consentimento), deixando claro que os dados serão usados para atendimento e propostas, conforme LGPD.`;

  const messages = [
    { role: 'system', content: sys },
    ...history.map(h => ({ role: h.role, content: h.content }))
  ];

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.5
  });

  const text = resp.choices?.[0]?.message?.content || '👍';
  const usage = resp.usage || { total_tokens: 0 };

  return { text, usage };
}

export async function storeUsage({ user_id=null, category='attend', usage }){
  if (!usage?.total_tokens) return;
  const periodStart = new Date(); periodStart.setDate(1); periodStart.setHours(0,0,0,0);
  const periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth()+1);
  await query(
    `INSERT INTO ai_credit_usage (user_id, category, period_start, period_end, used)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, category, period_start) DO UPDATE SET used = ai_credit_usage.used + EXCLUDED.used`,
    [user_id, category, periodStart, periodEnd, usage.total_tokens]
  );
}
