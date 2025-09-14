import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { canUse } from "../utils/featureGate";

export default function FeatureRoute({
  org,
  featureKey,
  limitKey,
  fallback = "/app",
  children,
}) {
  const allowed = canUse(org, featureKey, limitKey);
  const navigate = useNavigate();

  useEffect(() => {
    if (!allowed) navigate(fallback, { replace: true });
  }, [allowed, navigate, fallback]);

  if (!allowed) return null;
  return children;
}

