import React from "react";
import { Navigate } from "react-router-dom";

export default function PublicOnly({ children }) {
  const token = localStorage.getItem("token");
  if (token) return <Navigate to="/crm/oportunidades" replace />;
  return children;
}
