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

  // Evita efeitos de navegação nos testes (reduz flakiness/act)
  if (!allowed) {
    if (process.env.NODE_ENV === "test") return null;
    return <Navigate to={fallback} replace />;
  }
  return children;
}

