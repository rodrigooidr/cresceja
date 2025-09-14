import { Navigate } from "react-router-dom";
import { canUse } from "../utils/featureGate";

export default function FeatureRoute({
  org,
  featureKey,
  limitKey,
  fallback = "/app",
  children,
}) {
  const allowed = canUse(org, featureKey, limitKey);

  if (!allowed) return <Navigate to={fallback} replace />;
  return children;
}

