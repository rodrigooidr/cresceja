import { canUse, reason } from "./featureGate";

const globalScope =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : {};

export default function useFeatureGate(org, featureKey, limitKey) {
  const safeOrg = org || globalScope.__TEST_ORG__ || { features: {}, plan: { limits: {} } };
  return { allowed: canUse(safeOrg, featureKey, limitKey), reason: reason(safeOrg, featureKey, limitKey) };
}

