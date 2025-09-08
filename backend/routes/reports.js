import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authRequired, requireRole('admin','manager'));

router.get('/pipeline', async (req, res, next) => {
  const db = req.db;
  try {
    const { rows } = await db.query(
      `SELECT status, COALESCE(SUM(valor_estimado),0) AS total
         FROM opportunities
        GROUP BY status`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/conversion', async (req, res, next) => {
  const db = req.db;
  try {
    const leads = await db.query(`SELECT COUNT(*) FROM leads`);
    const opps = await db.query(`SELECT COUNT(*) FROM opportunities`);
    const ganhos = await db.query(`SELECT COUNT(*) FROM opportunities WHERE status = 'ganho'`);
    res.json({
      leads: Number(leads.rows[0].count),
      opportunities: Number(opps.rows[0].count),
      ganhos: Number(ganhos.rows[0].count)
    });
  } catch (err) { next(err); }
});

router.get('/atendimento', async (req, res, next) => {
  const db = req.db;
  try {
    const { rows } = await db.query(
      `SELECT
         AVG(CASE WHEN status = 'em_andamento' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) END) AS tempo_assumir,
         AVG(CASE WHEN status = 'resolvido' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) END) AS tempo_encerrar
       FROM conversations`
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/nps', async (req, res, next) => {
  const db = req.db;
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const { rows } = await db.query(
      `SELECT
         AVG(score) AS avg_score,
         SUM(CASE WHEN score <= 6 THEN 1 ELSE 0 END) AS detratores,
         SUM(CASE WHEN score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) AS neutros,
         SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) AS promotores
       FROM nps_responses
       WHERE responded_at >= NOW() - INTERVAL '${days} days'`
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/costs', async (req, res, next) => {
  const db = req.db;
  try {
    const rate_attend = Number(process.env.RATE_ATTEND || 0.0005);
    const rate_content = Number(process.env.RATE_CONTENT || 0.02);
    const { rows } = await db.query(
      `SELECT user_id, category, SUM(used)::int as used FROM ai_credit_usage GROUP BY user_id, category`
    );
    const costs = rows.map(x => ({
      user_id: x.user_id,
      category: x.category,
      used: Number(x.used),
      cost: x.category === 'attend' ? Number(x.used) * rate_attend : Number(x.used) * rate_content
    }));
    res.json({ rates: { rate_attend, rate_content }, items: costs });
  } catch (err) { next(err); }
});

router.get('/credits', async (req, res, next) => {
  const db = req.db;
  try {
    const { rows } = await db.query(
      `SELECT user_id, category, period_start, period_end, used FROM ai_credit_usage ORDER BY period_start DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
