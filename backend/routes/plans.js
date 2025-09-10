import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const r = Router();

/** Util: formata value tipado em string para a vitrine */
function displayValue(def, raw) {
  const v = raw?.value;
  if (def.type === 'number') {
    if (typeof v === 'number' && v < 0) return 'Ilimitado';
    const unit = def.unit ? ` ${def.unit}` : '';
    return `${v}${unit}`; // 0 vira '0' (exibe “Não incluso” na UI)
  }
  if (def.type === 'boolean') return v ? 'Sim' : 'Não';
  if (def.type === 'enum') {
    // mapeie “rótulos bonitos” no Admin; aqui devolvemos a raw string
    return String(v);
  }
  return String(v ?? '');
}

/** PUBLIC: tabela de preços */
r.get('/public/plans', async (req, res, next) => {
  try {
    const { rows: plans } = await db.query(
      `SELECT id, name, price_cents, currency, trial_days, sort_order
         FROM plans WHERE is_active = TRUE
       ORDER BY sort_order, price_cents ASC`
    );
    const { rows: defs } = await db.query(
      `SELECT code, label, type, unit, category, sort_order, is_public, show_as_tick, enum_options
         FROM feature_defs ORDER BY sort_order, code`
    );
    const { rows: feats } = await db.query(
      `SELECT pf.plan_id, pf.feature_code as code, pf.value
         FROM plan_features pf
         JOIN plans p ON p.id = pf.plan_id
        WHERE p.is_active = TRUE`
    );

    const byPlan = feats.reduce((acc, f) => {
      (acc[f.plan_id] = acc[f.plan_id] || []).push(f);
      return acc;
    }, {});
    const payload = plans.map(p => {
      const list = byPlan[p.id] || [];
      const features = {};
      for (const d of defs.filter(x => x.is_public)) {
        const f = list.find(x => x.code === d.code);
        features[d.code] = {
          label: d.label,
          type: d.type,
          showAsTick: d.show_as_tick,
          unit: d.unit,
          value: f?.value ?? null,
          display: f ? displayValue(d, f) : ''
        };
      }
      return { ...p, features };
    });

    res.json({ items: payload });
  } catch (err) { next(err); }
});

// --- Admin ---
r.use('/admin', authRequired, requireRole('SuperAdmin'));

/** ADMIN: CRUD de planos e recursos */
r.get('/admin/plans', async (req, res, next) => {
  try {
    const { rows: plans } = await db.query(`SELECT * FROM plans ORDER BY sort_order`);
    const { rows: defs } = await db.query(`SELECT * FROM feature_defs ORDER BY sort_order`);
    const { rows: feats } = await db.query(`SELECT * FROM plan_features`);
    res.json({ plans, feature_defs: defs, plan_features: feats });
  } catch (e) { next(e); }
});

// atualiza/insere valor de um recurso em um plano
r.put('/admin/plans/:planId/features/:featureCode', async (req, res, next) => {
  try {
    const { planId, featureCode } = req.params;
    const { value } = req.body; // deve vir como tipo nativo JS
    await db.query(
      `INSERT INTO plan_features(plan_id, feature_code, value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (plan_id, feature_code)
       DO UPDATE SET value = EXCLUDED.value`,
      [planId, featureCode, JSON.stringify(value)]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// cria/edita definição de recurso (para aparecer no form)
r.post('/admin/feature-defs', async (req, res, next) => {
  try {
    const { code, label, type, unit, enum_options, description, category, sort_order, is_public, show_as_tick } = req.body;
    await db.query(
      `INSERT INTO feature_defs(code,label,type,unit,enum_options,description,category,sort_order,is_public,show_as_tick)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (code) DO UPDATE
       SET label=$2,type=$3,unit=$4,enum_options=$5,description=$6,category=$7,sort_order=$8,is_public=$9,show_as_tick=$10`,
      [code, label, type, enum_options ?? null, description ?? null, category ?? null, sort_order ?? 0, is_public ?? true, show_as_tick ?? false]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
