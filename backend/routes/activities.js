import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import * as requireRoleMod from '../middleware/requireRole.js';
import * as ctrl from '../controllers/activitiesController.js';

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
  { OrgAgent: 'OrgAgent', OrgAdmin: 'OrgAdmin', OrgOwner: 'OrgOwner', SuperAdmin: 'SuperAdmin' };

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrg, requireRole(AGENT_ROLES));

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
