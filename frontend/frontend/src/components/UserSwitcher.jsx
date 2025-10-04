import inboxApi from "../../api/inboxApi";
import React, { useEffect, useState } from "react";
import inboxApi from "../api/inboxApi";
import { role as getRole } from "../utils/auth";

export default function UserSwitcher() {
  const role = getRole();
  const [users, setUsers] = useState([]);
  const [value, setValue] = useState(() => localStorage.getItem("actingUser") || "self");

  useEffect(() => {
    if (role !== "owner" && role !== "client_admin") return;
    let alive = true;
    (async () => {
      try {
        const { data } = await inboxApi.get("/admin/users");
        if (!alive) return;
        const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
        setUsers(list);
      } catch {
        if (alive) setUsers([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [role]);

  const handle = (e) => {
    const id = e.target.value;
    setValue(id);
    if (id === "self") localStorage.removeItem("actingUser");
    else localStorage.setItem("actingUser", id);
    window.dispatchEvent(new Event("acting-user-changed"));
  };

  if (role !== "owner" && role !== "client_admin") return null;

  return (
    <div className="mt-3">
      <label className="block text-xs text-gray-600 mb-1">Visualizar como</label>
      <select
        value={value}
        onChange={handle}
        className="w-full border rounded px-2 py-1 text-sm"
      >
        <option value="self">Eu (admin)</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email || u.id}
          </option>
        ))}
      </select>
    </div>
  );
}



