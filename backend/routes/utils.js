import { Router } from 'express';
import authRequired from '../middleware/auth.js';
import { lookupCNPJ, lookupCEP } from '../services/brasilapi.js';

const router = Router();

router.get('/cnpj/:cnpj', authRequired, async (req, res) => {
  const raw = (req.params.cnpj || '').replace(/\D+/g, '');
  if (raw.length !== 14) return res.status(422).json({ error: 'invalid_cnpj' });
  try {
    res.json(await lookupCNPJ(raw));
  } catch (e) {
    res.status(422).json({ error: e?.message || 'lookup_failed' });
  }
});

router.get('/cep/:cep', authRequired, async (req, res) => {
  const raw = (req.params.cep || '').replace(/\D+/g, '');
  if (raw.length !== 8) return res.status(422).json({ error: 'invalid_cep' });
  try {
    res.json(await lookupCEP(raw));
  } catch (e) {
    res.status(422).json({ error: e?.message || 'lookup_failed' });
  }
});

export default router;
