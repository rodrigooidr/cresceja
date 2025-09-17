import React from "react";
import { Navigate } from "react-router-dom";
import { hasPerm } from "@/auth/permCompat";

export default function RequirePerm({ perm: p, children }) {
  if (!hasPerm(p)) return <Navigate to="/not-authorized" replace />;
  return children;
}
