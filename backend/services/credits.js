
import { query as rootQuery } from '../config/db.js';

const DEFAULTS = {
  free:   { attend: 0, content: 0 },
  pro:    { attend: 3000, content: 40 },
  'pro+': { attend: 10000, content: 150 },
  enterprise: { attend: 100000, content: 1000 }
};

function currentPeriod(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth()+1, 1);
  return { start, end };
}

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

async function getPlan(db, userId){
  const r = await q(db)('SELECT plan FROM subscriptions WHERE user_id=$1', [userId]);
  return (r.rows[0]?.plan || 'free').toLowerCase();
}

export async function getCreditStatus(db, userId){
  const plan = await getPlan(db, userId);
  const { start, end } = currentPeriod();
  const r = await q(db)(
    `SELECT category, used FROM ai_credit_usage WHERE user_id=$1 AND period_start=$2 AND period_end=$3`,
    [userId, start.toISOString(), end.toISOString()]
  );
  const used = Object.fromEntries(r.rows.map(x => [x.category, Number(x.used)]));
  const limits = DEFAULTS[plan] || DEFAULTS.free;
  return { plan, period_start: start, period_end: end, limits, used };
}

export async function consumeCredit(db, userId, category, amount){
  const plan = await getPlan(db, userId);
  const limits = DEFAULTS[plan] || DEFAULTS.free;
  const limit = limits[category] ?? 0;
  const { start, end } = currentPeriod();
  const r = await q(db)(
    `INSERT INTO ai_credit_usage (user_id, category, period_start, period_end, used)
     VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (user_id, category, period_start, period_end) DO NOTHING
     RETURNING used`,
    [userId, category, start.toISOString(), end.toISOString()]
  );
  await q(db)(
    `UPDATE ai_credit_usage SET used = used + $1 WHERE user_id=$2 AND category=$3 AND period_start=$4 AND period_end=$5`,
    [amount, userId, category, start.toISOString(), end.toISOString()]
  );
  const status = await getCreditStatus(db, userId);
  const used = Number(status.used[category] || 0);
  return used <= limit;
}
