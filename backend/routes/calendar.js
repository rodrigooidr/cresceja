import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole, ROLES } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/calendarController.js';

const router = Router();

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrg, requireRole(AGENT_ROLES));

router.get('/', ctrl.listCalendars);
router.post('/', ctrl.createCalendar);
router.get('/:calendarId/events', ctrl.listEvents);
router.post('/:calendarId/events', ctrl.createEvent);
router.patch('/:calendarId/events/:id', ctrl.updateEvent);
router.delete('/:calendarId/events/:id', ctrl.removeEvent);

export default router;
