import React from "react";
import { Outlet } from "react-router-dom";
import useActiveOrgGate from "./useActiveOrgGate.js";

export default function ActiveOrgGate(props) {
  const { allowed } = useActiveOrgGate(props);
  if (!allowed) return null;
  return <Outlet />;
}
