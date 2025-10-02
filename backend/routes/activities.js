import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrgScope } from '../middleware/withOrg.js';
import { requireRole, ROLES } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/activitiesController.js';

const router = Router();

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrgScope, requireRole(AGENT_ROLES));

router.get('/calendars', ctrl.listCalendars);
router.post('/calendars', ctrl.createCalendar);
router.delete('/calendars/:calendarId', ctrl.removeCalendar);

router.get('/calendars/:calendarId/members', ctrl.listMembers);
router.post('/calendars/:calendarId/members', ctrl.addMember);
router.delete('/calendars/:calendarId/members/:userId', ctrl.removeMember);

router.get('/calendars/:calendarId/events', ctrl.listEvents);
router.post('/calendars/:calendarId/events', ctrl.createEvent);
router.patch('/calendars/:calendarId/events/:id', ctrl.updateEvent);
router.delete('/calendars/:calendarId/events/:id', ctrl.removeEvent);

export default router;
