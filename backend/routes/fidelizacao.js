import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  sendNps,
  respondNps,
  getNpsResults,
  createReward,
  getRewards,
  churnRisk,
} from '../controllers/fidelizacaoController.js';

const router = Router();

router.post('/nps/send', authRequired, sendNps);
router.post('/nps/respond/:surveyId', respondNps);
router.get('/nps/results', authRequired, getNpsResults);

router.post('/rewards', authRequired, createReward);
router.get('/rewards', authRequired, getRewards);

router.get('/churn-risk', authRequired, churnRisk);

export default router;
