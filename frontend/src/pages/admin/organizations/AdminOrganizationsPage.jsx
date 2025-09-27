import React, { useEffect, useMemo, useState } from "react";
import inboxApi, { listAdminOrgs, patchAdminOrg } from "../../../api/inboxApi";
import AdminOrgEditModal from "./AdminOrgEditModal.jsx";

const STATUS_FILTERS = [
  { value: "active", label: "Ativas" },
  { value: "inactive", label: "Inativas" },
  { value: "all", label: "Todas" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(value ?? "—");
  }
}

export default function AdminOrganizationsPage() {
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [state, setState] = useState({ loading: false, error: "", items: [] });
  const [editing, setEditing] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await listAdminOrgs(statusFilter, {
          params: {
            q: debouncedSearch || undefined,
          },
        });
        const { data } = response || {};
        if (cancelled) return;
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setState({ loading: false, error: "", items: list });
      } catch (e) {
        if (cancelled) return;
        const message =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "Falha ao carregar organizações.";
        setState({ loading: false, error: message, items: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, debouncedSearch, refreshTick]);

  const rows = useMemo(() => state.items || [], [state.items]);

  const toggleStatus = async (org) => {
    if (!org?.id) return;
    const nextStatus = org.status === "active" ? "inactive" : "active";
    try {
      await patchAdminOrg(org.id, { status: nextStatus });
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === org.id ? { ...item, status: nextStatus } : item,
        ),
      }));
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Não foi possível alterar o status.";
      // eslint-disable-next-line no-alert
      alert(message);
    }
  };

  const handleSaved = (updated) => {
    if (!updated?.id) return;
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    }));
    setEditing((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  };

  const reload = () => setRefreshTick((tick) => tick + 1);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-gray-500">Administre planos, status e créditos das organizações.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Buscar por nome ou documento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={reload}
            className="rounded border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            disabled={state.loading}
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatusFilter(option.value)}
            className={`rounded-full border px-4 py-1 text-sm ${
              statusFilter === option.value
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-blue-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {state.error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Trial</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {state.loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Carregando organizações…
                </td>
              </tr>
            )}
            {!state.loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Nenhuma organização encontrada.
                </td>
              </tr>
            )}
            {rows.map((org) => (
              <tr key={org.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{org.name || "—"}</div>
                  <div className="text-xs text-gray-500">{org.slug || org.document_value || ""}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-800">{org.plan_name || org.plan_id || "—"}</div>
                  {org.price_cents != null && (
                    <div className="text-xs text-gray-500">R$ {(org.price_cents / 100).toFixed(2)}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{formatDate(org.trial_ends_at)}</td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={org.status === "active"}
                      onChange={() => toggleStatus(org)}
                      className="h-4 w-4"
                    />
                    {org.status === "active" ? "Ativa" : "Inativa"}
                  </label>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(org)}
                    className="rounded border border-gray-200 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdminOrgEditModal
          open={!!editing}
          org={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
