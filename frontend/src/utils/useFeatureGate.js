import { canUse, reason } from "./featureGate";

export default function useFeatureGate(org, featureKey, limitKey) {
  const safeOrg = org || globalThis.__TEST_ORG__ || { features: {}, plan: { limits: {} } };
  return { allowed: canUse(safeOrg, featureKey, limitKey), reason: reason(safeOrg, featureKey, limitKey) };
}

