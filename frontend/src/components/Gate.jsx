import { canUse, limitKeyFor } from "../utils/featureGate";

export default function Gate({ org, feature, limitKey, fallback = null, children }) {
  const allowed = canUse(org, feature, limitKey ?? limitKeyFor(feature));
  return allowed ? children : fallback;
}

