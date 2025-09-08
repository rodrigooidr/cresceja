import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext";

export function RequireOrg({ children }) {
  const { user } = useAuth();
  const { selected, orgs, canSeeSelector } = useOrg();

  if (!selected) {
    if (canSeeSelector && orgs.length > 0) {
      return <div className="p-6">Selecione uma organização no painel lateral para continuar.</div>;
    }
    return <div className="p-6">Sem organização disponível.</div>;
  }
  return children;
}

export function RequireGlobal({ children }) {
  const { user } = useAuth();
  if (user?.role !== "SuperAdmin" && user?.role !== "Support") {
    return <Navigate to="/403" replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user || (user.role !== "SuperAdmin" && user.role !== "Support")) {
    return <Navigate to="/403" replace />;
  }
  return children;
}

