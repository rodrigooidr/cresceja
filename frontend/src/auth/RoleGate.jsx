import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RoleGate({ allow, redirectTo = "/" }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow?.(user.role)) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}
