import React, { useCallback, useEffect, useState } from 'react';
import {
  adminListOrgs,
  deleteAdminOrg,
  getAdminOrg,
} from '@/api/inboxApi';
import AdminOrgEditModal from './AdminOrgEditModal.jsx';

const STATUS_FILTERS = [
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
  { value: 'all', label: 'Todas' },
];

function normalizeOrgData(org) {
  if (!org) {
    return {
      id: null,
      name: '',
      slug: '',
      status: 'inactive',
      plan: null,
    };
  }
  const status = String(org.status ?? '').toLowerCase();
  return {
    id: org.id ?? null,
    name: org.name ?? org.razao_social ?? 'Sem nome',
    slug: org.slug ?? '',
    status: status || 'inactive',
    plan: org.plan ?? null,
    raw: org,
  };
}

function StatusBadge({ status }) {
  const active = String(status).toLowerCase() === 'active';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}
      />
      {active ? 'Ativa' : 'Inativa'}
    </span>
  );
}

export default function AdminOrganizationsPage() {
  const [status, setStatus] = useState('active');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loadingOrgId, setLoadingOrgId] = useState(null);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminListOrgs({ status, q: query });
      const mapped = (Array.isArray(data) ? data : []).map(normalizeOrgData);
      setItems(mapped);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Falha ao carregar organizações.';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedOrg(null);
    setModalOpen(true);
  };

  const openEditModal = async (org) => {
    if (!org?.id) return;
    setLoadingOrgId(org.id);
    try {
      const full = await getAdminOrg(org.id);
      setSelectedOrg(full ?? org.raw ?? org);
      setModalMode('edit');
      setModalOpen(true);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Falha ao carregar organização.';
      setError(message);
    } finally {
      setLoadingOrgId(null);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedOrg(null);
  };

  const handleSaved = async () => {
    closeModal();
    await loadOrganizations();
  };

  const handleDelete = async (org) => {
    if (!org?.id) return;
    const label = org.name || 'esta organização';
    if (!window.confirm(`Deseja excluir ${label}?`)) return;
    try {
      await deleteAdminOrg(org.id);
      await loadOrganizations();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Falha ao excluir organização.';
      setError(message);
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Organizações</h1>
          <p className="text-sm text-gray-500">Gerencie empresas, planos e acesso.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          + Nova organização
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">
          <span className="mr-2">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-1 min-w-[200px] items-center gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nome ou slug"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            Buscar
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Nome
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Plano
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Carregando organizações…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Nenhuma organização encontrada.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-gray-500">{org.slug || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{org.plan || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(org)}
                        disabled={loadingOrgId === org.id}
                        className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingOrgId === org.id ? 'Abrindo…' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(org)}
                        className="rounded px-3 py-1 text-sm text-red-600 transition hover:bg-red-50"
                        aria-label={`Excluir ${org.name}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <AdminOrgEditModal
        open={modalOpen}
        mode={modalMode}
        org={selectedOrg}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </div>
  );
}
