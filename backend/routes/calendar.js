import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import * as requireRoleMod from '../middleware/requireRole.js';
import * as ctrl from '../controllers/calendarController.js';

const router = Router();

const requireRole = requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;

router.use(authRequired, withOrg, requireRole('Agent'));

router.get('/', ctrl.listCalendars);
router.post('/', ctrl.createCalendar);
router.get('/:calendarId/events', ctrl.listEvents);
router.post('/:calendarId/events', ctrl.createEvent);
router.patch('/:calendarId/events/:id', ctrl.updateEvent);
router.delete('/:calendarId/events/:id', ctrl.removeEvent);

export default router;
