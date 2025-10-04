import { Router } from 'express';
import { authRequired, orgScope } from '../middleware/auth.js';

const r = Router();
r.use(authRequired, orgScope);

// Resposta mínima para UI; conecte ao plano/limites reais depois
r.get('/status', async (req, res) => {
  return res.json({
    ok: true,
    orgId: req.orgId,
    categories: {
      support: { used: 0, limit: 10000, period: 'monthly' }, // atendimento
      content: { used: 0, limit: 2000, period: 'monthly' }, // criação de conteúdo
    },
    resetAt: null,
  });
});

export default r;
