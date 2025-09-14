import React from "react";
import { Navigate } from "react-router-dom";
import { canUse, limitKeyFor } from "../utils/featureGate";

export default function FeatureRoute({ org, feature, element, redirect = "/upgrade" }) {
  return canUse(org, feature, limitKeyFor(feature)) ? element : <Navigate to={redirect} replace />;
}

