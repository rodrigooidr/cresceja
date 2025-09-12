import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { CAN_VIEW_ORGANIZATIONS_ADMIN, CAN_EDIT_CLIENTS } from "../../auth/roles";

export default function Sidebar() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <nav data-testid="sidebar" className="h-full p-3">
      <ul className="space-y-2">
        <li><NavLink to="/inbox">Inbox</NavLink></li>

        {CAN_EDIT_CLIENTS(role) && (
          <li><NavLink to="/clients">Clientes</NavLink></li>
        )}

        {CAN_VIEW_ORGANIZATIONS_ADMIN(role) && (
          <li><NavLink to="/admin/organizations">Organizações</NavLink></li>
        )}
      </ul>
    </nav>
  );
}
