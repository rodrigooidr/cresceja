import { useMemo } from "react";
import { canUse, gateReason, limitKeyFor } from "./featureGate";

export default function useFeatureGate(org, featureKey, limitKey) {
  return useMemo(() => {
    const key = limitKey ?? limitKeyFor(featureKey);
    return {
      allowed: canUse(org, featureKey, key),
      reason: gateReason(org, featureKey, key),
    };
  }, [org, featureKey, limitKey]);
}

