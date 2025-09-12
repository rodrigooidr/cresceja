import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import useActiveOrg from "./useActiveOrg.js";

export default function ActiveOrgGate() {
  const { activeOrg } = useActiveOrg();
  if (!activeOrg) return <Navigate to="/admin/organizations" replace />;
  return <Outlet />;
}
