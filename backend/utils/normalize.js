export function normalizePlan(p){
  // aceita camelCase e snake_case
  const n = {
    id: p.id,
    name: p.name,
    monthlyPrice: num(p.monthlyPrice ?? p.monthly_price ?? 0),
    currency: (p.currency || "BRL").toUpperCase(),
    is_published: bool(p.is_published ?? p.isPublished ?? false),
    sort_order: num(p.sort_order ?? p.sortOrder ?? 9999),
    is_free: bool(p.is_free ?? p.isFree ?? false),
    trial_days: num(p.trial_days ?? p.trialDays ?? 14),
    billing_period_months: num(p.billing_period_months ?? p.billingPeriodMonths ?? 1),
    modules: p.modules || {}
  };
  return n;
}
const num = (v)=> Number(v ?? 0);
const bool = (v)=> !!v;
