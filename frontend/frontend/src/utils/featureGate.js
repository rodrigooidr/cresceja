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

export function isEnabled(org, key) {
  const v = org?.features?.[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["enabled", "on", "true", "1"].includes(v.toLowerCase());
  if (typeof v === "number") return v === 1;
  return false;
}

function parseLimit(val) {
  if (val == null) return undefined;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (["unlimited","ilimitado","∞"].includes(s)) return Infinity;
    const n = Number(s); return Number.isNaN(n) ? undefined : n;
  }
  if (typeof val === "number") return val;
  return undefined;
}

export function canUse(org, featureKey, limitKey) {
  const enabled = isEnabled(org, featureKey);
  if (!enabled) return false;
  if (!limitKey) return true;
  const n = parseLimit(org?.plan?.limits?.[limitKey]);
  if (n === undefined) return true;
  if (n === Infinity || n === -1) return true;
  return n > 0;
}

export function reason(org, featureKey, limitKey) {
  if (!isEnabled(org, featureKey)) return "feature_disabled";
  if (!limitKey) return null;
  const n = parseLimit(org?.plan?.limits?.[limitKey]);
  if (n === undefined || n === Infinity || n === -1) return null;
  return n > 0 ? null : "limit_reached";
}

