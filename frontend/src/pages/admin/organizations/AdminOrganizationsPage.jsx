import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminListOrgs,
  deleteAdminOrg,
  getAdminOrg,
} from '@/api/inboxApi';
import AdminOrgEditModal from './AdminOrgEditModal.jsx';

const STATUS_LABELS = {
  active: 'Ativa',
  trial: 'Em avaliação',
  suspended: 'Suspensa',
  canceled: 'Cancelada',
};

const STATUS_FILTERS = [
  { value: 'active', label: 'Ativas' },
  { value: 'trial', label: 'Em avaliação' },
  { value: 'suspended', label: 'Suspensas' },
  { value: 'canceled', label: 'Canceladas' },
  { value: 'all', label: 'Todas' },
];

function normalizeStatus(value) {
  if (value == null) return 'active';
  const normalized = String(value).trim().toLowerCase();
  if (STATUS_LABELS[normalized]) return normalized;
  if (normalized === 'inactive' || normalized === 'inativa') return 'suspended';
  return 'active';
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function normalizeOrgData(org) {
  if (!org) {
    return {
      id: null,
      name: '',
      slug: '',
      status: 'active',
      plan: null,
    };
  }
  const status = normalizeStatus(org.status);
  return {
    id: org.id ?? null,
    name: org.name ?? org.razao_social ?? 'Sem nome',
    slug: org.slug ?? '',
    status,
    plan: org.plan ?? null,
    raw: org,
  };
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  const label = STATUS_LABELS[normalized] ?? 'Desconhecido';
  const colorMap = {
    active: 'bg-green-500',
    trial: 'bg-blue-500',
    suspended: 'bg-amber-500',
    canceled: 'bg-red-500',
  };
  const color = colorMap[normalized] ?? 'bg-gray-300';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function AdminOrganizationsPage() {
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const qDebounced = useDebounced(q, 300);
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
      const response = await adminListOrgs({ status, q: qDebounced.trim() });
      const list = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
        ? response
        : [];
      const mapped = list.map(normalizeOrgData);
      setItems(mapped);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Falha ao carregar organizações.';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, qDebounced]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
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
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por nome ou slug"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

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
                      <Link
                        to={`/admin/organizations/${org.id}/history`}
                        className="rounded border border-blue-200 px-3 py-1 text-sm text-blue-600 transition hover:bg-blue-50"
                      >
                        Histórico
                      </Link>
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
