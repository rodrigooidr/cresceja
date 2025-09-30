import { Router } from 'express';
import authRequired from '../middleware/auth.js';
import { lookupCNPJ, lookupCEP } from '../services/brasilapi.js';

const router = Router();

router.get('/cnpj/:cnpj', authRequired, async (req, res) => {
  try {
    const data = await lookupCNPJ(req.params.cnpj);
    return res.json(data);
  } catch (e) {
    return res.status(422).json({ error: e.message });
  }
});

router.get('/cep/:cep', authRequired, async (req, res) => {
  try {
    const data = await lookupCEP(req.params.cep);
    return res.json(data);
  } catch (e) {
    return res.status(422).json({ error: e.message });
  }
});

export default router;
