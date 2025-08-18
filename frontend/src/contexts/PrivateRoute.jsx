// src/contexts/PrivateRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  const location = useLocation();
  if (!token) {
    // não logado -> manda para /login e preserva a rota de origem
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
