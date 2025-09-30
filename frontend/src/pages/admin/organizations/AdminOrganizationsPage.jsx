import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListOrgs,
  deleteAdminOrg,
} from "@/api/inboxApi";
import AdminOrgEditModal from "./AdminOrgEditModal.jsx";

function StatusBadge({ status }) {
  const active = String(status).toLowerCase() === "active";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${active ? "bg-green-500" : "bg-gray-300"}`}
        aria-hidden="true"
      />
      {active ? "Ativa" : "Inativa"}
    </span>
  );
}

const STATUS_FILTERS = [
  { value: "active", label: "Ativas" },
  { value: "inactive", label: "Inativas" },
  { value: "all", label: "Todas" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR").format(date);
  } catch {
    return "—";
  }
}

function normalizeOrg(org) {
  if (!org || typeof org !== "object") return null;
  const status = org.status
    ? String(org.status).toLowerCase()
    : typeof org.active === "boolean"
    ? org.active
      ? "active"
      : "inactive"
    : "inactive";
  return {
    ...org,
    status,
    active: status === "active",
  };
}

export default function AdminOrganizationsPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("active");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminListOrgs({ status, q: query });
      const list = Array.isArray(data) ? data : [];
      setItems(list.map((org) => normalizeOrg(org)).filter(Boolean));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Falha ao carregar organizações.";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleStatusChange = (value) => {
    setStatus(value);
  };

  const handleSearch = useCallback(() => {
    setQuery(searchInput.trim());
  }, [searchInput]);

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  const openCreate = () => {
    setSelectedOrg(null);
    setModalMode("create");
  };

  const openEdit = (org) => {
    setSelectedOrg(org);
    setModalMode("edit");
  };

  const closeModal = () => {
    setSelectedOrg(null);
    setModalMode(null);
  };

  const handleSaved = () => {
    closeModal();
    fetchOrgs();
  };

  const handleDelete = async (org) => {
    if (!org) return;
    const confirmed = window.confirm(`Deseja excluir a organização "${org.name}"?`);
    if (!confirmed) return;
    try {
      await deleteAdminOrg(org.id);
      fetchOrgs();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Falha ao excluir organização.";
      setError(message);
    }
  };

  const showModal = modalMode === "create" || modalMode === "edit";

  const tableItems = useMemo(() => items, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizações</h1>
          <p className="text-sm text-gray-500">Gerencie empresas, status e configurações gerais.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          + Nova organização
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleStatusChange(option.value)}
            className={`rounded-full border px-4 py-1 text-sm transition ${
              status === option.value
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-blue-200"
            }`}
          >
            {option.label}
          </button>
        ))}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar por nome…"
            className="flex-1 rounded border px-3 py-2 text-sm"
            type="search"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:border-blue-200 hover:text-blue-700"
          >
            Buscar
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Carregando…</div>}
      {!loading && error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && tableItems.length === 0 && (
        <div className="text-sm text-gray-500">Nenhuma organização encontrada.</div>
      )}

      {!loading && !error && tableItems.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Trial</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tableItems.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{org.name || org.razao_social || "—"}</div>
                    <div className="text-xs text-gray-500">{org.slug || org.cnpj || ""}</div>
                  </td>
                  <td className="px-4 py-3">{org.plan_name ?? org.plan ?? org.plan_id ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(org.trial_ends_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        onClick={() => openEdit(org)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                        onClick={() => handleDelete(org)}
                        aria-label={`Excluir ${org.name}`}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminOrgEditModal
        open={showModal}
        mode={modalMode}
        org={modalMode === "edit" ? selectedOrg : null}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </div>
  );
}

export { StatusBadge };
