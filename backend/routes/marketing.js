import { Router } from 'express';
import {
  listLists,
  createList,
  updateList,
  deleteList,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCampaigns,
  createCampaign,
  deleteCampaign,
  sendTest,
  scheduleCampaign,
  handleWebhook,
} from '../controllers/marketingController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Agent'));

router.get('/lists', listLists);
router.post('/lists', createList);
router.put('/lists/:id', updateList);
router.delete('/lists/:id', deleteList);

router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.post('/campaigns/:id/test', sendTest);
router.post('/campaigns/:id/schedule', requireRole('Manager'), scheduleCampaign);

router.post('/webhooks/:provider', handleWebhook);

export default router;
