// Utils para controlar visibilidade de seções por feature + limites do plano

export const featureLimitMap = {
  calendar: "calendar",
  facebook: "facebook_pages",
  instagram: "instagram_accounts",
  whatsapp: "wa_numbers",
};

export function limitKeyFor(featureKey) {
  return featureLimitMap[featureKey] || featureKey;
}

function asNumber(v, fb = 0) {
  if (v == null) return fb;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : fb;
}

export function getLimit(org, key, fallback = 0) {
  const planLimits = org?.plan?.limits || org?.limits || {};
  let v = planLimits[key];
  if (typeof v === "string" && v.trim() !== "") v = Number(v);
  return Number.isFinite(v) ? v : fallback;
}

export function isEnabled(org, featureKey) {
  const v = org?.features?.[featureKey];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    return ["enabled", "on", "true", "1"].includes(v.toLowerCase());
  }
  if (typeof v === "number") return v === 1;
  return false;
}

/** ok | feature_disabled | limit_zero */
export function gateReason(org, featureKey, limitKey = featureKey) {
  if (!isEnabled(org, featureKey)) return "feature_disabled";
  const lim = getLimit(org, limitKey, 0);
  if (!(lim === -1 || lim > 0)) return "limit_zero";
  return "ok";
}

export function canUse(org, featureKey, limitKey = featureKey) {
  return gateReason(org, featureKey, limitKey) === "ok";
}

