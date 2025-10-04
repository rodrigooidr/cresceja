import useOrgFeatures from '../../hooks/useOrgFeatures';

export default function FeatureGate({ code, children, fallback=null }) {
  const { features } = useOrgFeatures();
  const f = features[code];
  if (!f) return null;
  if (!f.enabled || f.limit === 0) return fallback;
  return children;
}
