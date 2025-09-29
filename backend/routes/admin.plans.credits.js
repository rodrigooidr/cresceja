// backend/routes/admin.plans.credits.js
import express from "express";
import { query } from '#db';

const router = express.Router({ mergeParams: true });

// GET /api/admin/plans/:id/credits
router.get('/', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `
      SELECT plan_id,
             ai_attendance_monthly,
             ai_content_monthly
        FROM public.plan_credits
       WHERE plan_id = $1
    `,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ code: 'not_found' });

    res.json({
      plan_id: rows[0].plan_id,
      ai: {
        attendance_monthly: rows[0].ai_attendance_monthly,
        content_monthly: rows[0].ai_content_monthly,
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/plans/:id/credits
// Compat: aceita { tokens } OU { ai:{attendance_monthly, content_monthly} }
router.put('/', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const ai = body.ai || {};

    const tokensCompat =
      Number.isFinite(+body.tokens) ? +body.tokens
      : Number.isFinite(+body.tokens_monthly) ? +body.tokens_monthly
      : null;

    const attendance = Number.isFinite(+ai.attendance_monthly)
      ? +ai.attendance_monthly
      : (tokensCompat ?? 0);

    const content = Number.isFinite(+ai.content_monthly)
      ? +ai.content_monthly
      : (tokensCompat ?? 0);

    const { rows } = await query(
      `
      INSERT INTO public.plan_credits (plan_id, ai_attendance_monthly, ai_content_monthly, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (plan_id) DO UPDATE
         SET ai_attendance_monthly = EXCLUDED.ai_attendance_monthly,
             ai_content_monthly    = EXCLUDED.ai_content_monthly,
             updated_at            = now()
      RETURNING plan_id, ai_attendance_monthly, ai_content_monthly
    `,
      [id, attendance, content]
    );

    res.json({
      plan_id: rows[0].plan_id,
      ai: {
        attendance_monthly: rows[0].ai_attendance_monthly,
        content_monthly: rows[0].ai_content_monthly,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
