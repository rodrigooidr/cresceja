import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext.jsx";

function normalizeRole(role) {
  if (!role) return "";
  return String(role).trim().toLowerCase();
}

function parseRoles(roles) {
  if (!roles) return [];
  if (Array.isArray(roles)) {
    return roles
      .flatMap((entry) => String(entry || "").split("|"))
      .map(normalizeRole)
      .filter(Boolean);
  }
  return String(roles)
    .split("|")
    .map(normalizeRole)
    .filter(Boolean);
}

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();
  const allowedRoles = parseRoles(roles);
  const userRole = normalizeRole(user?.role);

  if (allowedRoles.length && allowedRoles.includes(userRole)) {
    return children;
  }

  return <Navigate to="/not-authorized" replace state={{ from: location }} />;
}
