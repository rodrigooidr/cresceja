import React from "react";
import { canUse, limitKeyFor } from "./featureGate";

export default function withGate(Wrapped, { feature, limitKey, Fallback = () => null }) {
  return function Gated(props) {
    const { org } = props;
    const allowed = canUse(org, feature, limitKey ?? limitKeyFor(feature));
    return allowed ? <Wrapped {...props} /> : <Fallback {...props} />;
  };
}

