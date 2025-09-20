
import { query } from '#db';

let openaiClientPromise;

async function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClientPromise) {
    openaiClientPromise = import('openai')
      .then(({ default: OpenAI }) => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))
      .catch((err) => {
        console.error('Failed to load OpenAI SDK', err);
        openaiClientPromise = null;
        throw err;
      });
  }

  return openaiClientPromise;
}

const tones = {
  whatsapp: 'próximo e casual, direto, claro e com toques de humor leve',
  instagram: 'visual e leve, frases curtas e emojis ocasionais',
  facebook: 'mais formal e estruturado, com passos e bullets quando útil'
};

const fallbackResponse = {
  text: 'Olá! Me conte como posso ajudar 😊',
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
};

export async function aiReply({ channel_type='whatsapp', history=[], companyProfile={} }){
  let openai;
  try {
    openai = await getOpenAI();
  } catch (err) {
    console.error('OpenAI client unavailable', err);
    return fallbackResponse;
  }

  if (!openai) return fallbackResponse;

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
