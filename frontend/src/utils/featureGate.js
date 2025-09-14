// Utils para controlar visibilidade de seções por feature + limites do plano
export function getLimit(org, key, fallback = 0) {
  const planLimits = org?.plan?.limits || org?.limits || {};
  const v = planLimits[key];
  return typeof v === 'number' ? v : fallback;
}

export function isEnabled(org, featureKey) {
  const f = org?.features?.[featureKey];
  // Aceita boolean ou string "enabled"
  return f === true || f === 'enabled';
}

/**
 * Regra pedida pelos testes:
 * VISÍVEL apenas se (feature habilitada) E (limit === -1 (ilimitado) OU limit > 0)
 * Esconde se desabilitada OU limit === 0.
 */
export function canUse(org, featureKey, limitKey = featureKey) {
  const enabled = isEnabled(org, featureKey);
  const limit = getLimit(org, limitKey, 0);
  return enabled && (limit === -1 || limit > 0);
}
