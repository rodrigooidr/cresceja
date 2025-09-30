import { Router } from 'express';
import authRequired from '../middleware/auth.js';
import { lookupCNPJ, lookupCEP } from '../services/brasilapi.js';

const router = Router();

router.get('/cnpj/:cnpj', authRequired, async (req, res) => {
  try {
    res.json(await lookupCNPJ(req.params.cnpj));
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

router.get('/cep/:cep', authRequired, async (req, res) => {
  try {
    res.json(await lookupCEP(req.params.cep));
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

export default router;
