import { Router } from 'express';
const r = Router();

r.get('/rls', async (req, res, next) => {
  try {
    const db = req.db;
    const { rows } = await db.query(`
      SELECT
        current_setting('app.org_id', true)  AS org_id,
        current_setting('app.user_id', true) AS user_id,
        current_setting('app.role',   true)  AS role
    `);
    res.json(rows[0] || {});
  } catch (e) { next(e); }
});

export default r;
