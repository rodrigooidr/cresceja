import { useEffect, useState } from "react";
import { adminListOrgs } from "@/api/inboxApi";

export default function AdminOrganizationsPage() {
  const [tab, setTab] = useState("active");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminListOrgs({ status: tab });
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        {[
          { value: "active", label: "Ativas" },
          { value: "inactive", label: "Inativas" },
          { value: "all", label: "Todas" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={`rounded-full border px-4 py-1 text-sm ${
              tab === option.value
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-blue-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Plano</th>
            <th>Trial</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((org) => (
            <tr key={org.id}>
              <td>
                <div className="font-medium">{org.name}</div>
                <div className="text-xs text-gray-500">{org.slug}</div>
              </td>
              <td>{org.plan_name ?? "—"}</td>
              <td>{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : "—"}</td>
              <td>{org.status === "active" ? "Ativa" : "Inativa"}</td>
              <td>
                <button type="button" className="text-blue-600">
                  Editar
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-gray-500">
                Nenhuma organização.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
