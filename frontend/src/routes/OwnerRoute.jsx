import React from "react";
import { Navigate, Outlet } from "react-router-dom";

function getRole() {
  try {
    return JSON.parse(atob((localStorage.getItem("token") || ".").split(".")[1])).role;
  } catch {
    return null;
  }
}

export default function OwnerRoute({ children }) {
  const role = getRole();
  if (!role) return <Navigate to="/login" replace />;
  if (role !== "owner") return <Navigate to="/crm/oportunidades" replace />;
  return children || <Outlet />;
}
