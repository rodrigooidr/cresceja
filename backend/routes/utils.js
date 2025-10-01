import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { lookupCNPJ, lookupCEP } from '../services/brasilapi.js';

const router = express.Router();

const onlyDigits = (s = '') => s.replace(/\D+/g, '');

router.get('/cnpj/:cnpj', authRequired, async (req, res) => {
  const raw = onlyDigits(req.params.cnpj);
  if (raw.length !== 14) return res.status(422).json({ error: 'invalid cnpj' });
  try {
    res.json(await lookupCNPJ(raw));
  } catch (e) {
    const err = String(e?.message || '').toLowerCase();
    if (err === 'invalid_cnpj') {
      return res.status(422).json({ error: 'invalid cnpj' });
    }
    return res.status(422).json({ error: err || 'lookup_failed' });
  }
});

router.get('/cep/:cep', authRequired, async (req, res) => {
  const raw = onlyDigits(req.params.cep);
  if (raw.length !== 8) return res.status(422).json({ error: 'invalid cep' });
  try {
    res.json(await lookupCEP(raw));
  } catch (e) {
    const err = String(e?.message || '').toLowerCase();
    if (err === 'invalid_cep') {
      return res.status(422).json({ error: 'invalid cep' });
    }
    return res.status(422).json({ error: err || 'lookup_failed' });
  }
});

export default router;
