// Simulação de dados em memória para demonstração
const usageLogs = [
  { category: 'chat', service: 'gpt4o', company_id: 'demo', tokens_used: 1 },
  { category: 'chat', service: 'gpt4o', company_id: 'demo', tokens_used: 1 },
  { category: 'content', service: 'gpt4o', company_id: 'demo', tokens_used: 1 },
  { category: 'content', service: 'dalle3', company_id: 'demo', tokens_used: 1 },
];

const plans = {
  free: { chat: 30, text: 0, image: 0 },
  pro: { chat: 300, text: 30, image: 10 },
  proplus: { chat: 1000, text: 100, image: 50 },
};

exports.getStatus = (req, res) => {
  const user = req.user;
  const companyId = user.company_id;
  const plan = (user.plan || 'free').toLowerCase();

  const used = {
    chat: usageLogs.filter(l => l.company_id === companyId && l.category === 'chat').length,
    content: {
      text: usageLogs.filter(l => l.company_id === companyId && l.category === 'content' && l.service === 'gpt4o').length,
      image: usageLogs.filter(l => l.company_id === companyId && l.category === 'content' && l.service === 'dalle3').length
    }
  };

  const limits = plans[plan];

  res.json({
    chat: { used: used.chat, limit: limits.chat },
    content: {
      text: { used: used.content.text, limit: limits.text },
      image: { used: used.content.image, limit: limits.image }
    }
  });
};