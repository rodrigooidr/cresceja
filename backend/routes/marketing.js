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
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  getAutomationStatus,
  updateAutomationStatus,
} from '../controllers/marketingController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import * as requireRoleMod from '../middleware/requireRole.js';

const router = Router();

const requireRole =
  requireRoleMod.requireRole ??
  requireRoleMod.default?.requireRole ??
  requireRoleMod.default ??
  requireRoleMod;
const ROLES =
  requireRoleMod.ROLES ??
  requireRoleMod.default?.ROLES ??
  requireRoleMod.ROLES ??
  {
    OrgAgent: 'OrgAgent',
    OrgAdmin: 'OrgAdmin',
    OrgOwner: 'OrgOwner',
    SuperAdmin: 'SuperAdmin',
  };

const MARKETING_AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];
const MARKETING_MANAGER_ROLES = [ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrg, requireRole(MARKETING_AGENT_ROLES));

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
router.post('/campaigns/:id/schedule', requireRole(MARKETING_MANAGER_ROLES), scheduleCampaign);

router.get('/automations', requireRole(MARKETING_MANAGER_ROLES), listAutomations);
router.post('/automations', requireRole(MARKETING_MANAGER_ROLES), createAutomation);
router.put('/automations/:id', requireRole(MARKETING_MANAGER_ROLES), updateAutomation);
router.delete('/automations/:id', requireRole(MARKETING_MANAGER_ROLES), deleteAutomation);
router.get('/automations/:id/status', requireRole(MARKETING_MANAGER_ROLES), getAutomationStatus);
router.put('/automations/:id/status', requireRole(MARKETING_MANAGER_ROLES), updateAutomationStatus);

router.post('/webhooks/:provider', handleWebhook);

export default router;
