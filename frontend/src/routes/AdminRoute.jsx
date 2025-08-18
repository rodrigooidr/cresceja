import React from "react";
import { Navigate, Outlet } from "react-router-dom";

function getRole(){
  try { return JSON.parse(atob((localStorage.getItem("token")||".").split(".")[1])).role; }
  catch { return null; }
}

export default function AdminRoute({ children }){
  const role = getRole();
  if (!role) return <Navigate to="/login" replace />;
  if (role !== "owner" && role !== "client_admin") return <Navigate to="/crm/oportunidades" replace />;
  // Se usar nesting, renderize Outlet; ou envolva <MainLayout/> aqui
  return children || <Outlet />;
}
