import { Router } from 'express';
import authRequired from '../middleware/auth.js';
import { lookupCNPJ, lookupCEP } from '../services/brasilapi.js';

const router = Router();

router.get('/cnpj/:cnpj', authRequired, async (req, res) => {
  try {
    const data = await lookupCNPJ(req.params.cnpj);
    res.json(data);
  } catch (e) {
    const msg = e?.message || 'lookup_failed';
    const status = msg === 'invalid_cnpj' ? 422 : 422;
    res.status(status).json({ error: msg });
  }
});

router.get('/cep/:cep', authRequired, async (req, res) => {
  try {
    const data = await lookupCEP(req.params.cep);
    res.json(data);
  } catch (e) {
    const msg = e?.message || 'lookup_failed';
    const status = msg === 'invalid_cep' ? 422 : 422;
    res.status(status).json({ error: msg });
  }
});

export default router;
