import * as requireRoleMod from '../middleware/requireRole.js';

export const requireRole = requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;

export default requireRole;
