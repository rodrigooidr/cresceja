import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { hasGlobalRole, hasOrgRole } from "@/auth/roles";

function splitRoles(roles = []) {
  const list = Array.isArray(roles) ? roles : [roles];
  const orgRoles = [];
  const globalRoles = [];
  list
    .map((role) => String(role || "").trim())
    .filter(Boolean)
    .forEach((role) => {
      if (role === "SuperAdmin" || role === "Support") {
        globalRoles.push(role);
      } else {
        orgRoles.push(role);
      }
    });
  return { orgRoles, globalRoles };
}

export default function RequireRole({ roles, orgRoles, globalRoles, children, redirectTo = "/not-authorized" }) {
  const { user } = useAuth();
  const location = useLocation();
  const source = user;

  const combined = splitRoles(roles);
  const wantedOrg = orgRoles ?? combined.orgRoles;
  const wantedGlobal = globalRoles ?? combined.globalRoles;

  const okOrg = !wantedOrg?.length || hasOrgRole(wantedOrg, source);
  const okGlobal = !wantedGlobal?.length || hasGlobalRole(wantedGlobal, source);

  if ((wantedOrg?.length || wantedGlobal?.length) && !(okOrg || okGlobal)) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children;
}
