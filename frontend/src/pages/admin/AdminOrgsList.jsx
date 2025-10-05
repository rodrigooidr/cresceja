import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListOrgs } from '../../api/inboxApi';
import { useOrg } from '../../contexts/OrgContext.jsx';
import useToastFallback from '../../hooks/useToastFallback';

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export default function AdminOrgsList() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const toast = useToastFallback();
  const debouncedQ = useDebounce(q, 300);
  const pendingResetRef = useRef(false);
  const lastQRef = useRef(debouncedQ);

  useEffect(() => {
    if (lastQRef.current !== debouncedQ) {
      lastQRef.current = debouncedQ;
      pendingResetRef.current = true;
      setPage(1);
    }
  }, [debouncedQ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const raw = await adminListOrgs({ q: debouncedQ, page, pageSize: 20 });
      const list =
        Array.isArray(raw?.items) ? raw.items :
        Array.isArray(raw?.data) ? raw.data :
        Array.isArray(raw?.orgs) ? raw.orgs :
        Array.isArray(raw) ? raw : [];
      setItems(list);
    } catch (e) {
      setError(true);
      toast({ title: 'Falha ao carregar organizações' });
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, toast]);

  useEffect(() => {
    if (pendingResetRef.current && page !== 1) {
      return;
    }
    if (pendingResetRef.current) {
      pendingResetRef.current = false;
    }
    load();
  }, [load, page]);

  const { setSelected } = useOrg();
  const handleImpersonate = (org) => {
    setSelected(org.id);
  };

  if (loading || error) {
    return <div className="p-4 animate-pulse">Carregando…</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Organizações</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar..."
        className="border p-2 mb-4 w-full max-w-sm"
      />
      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Nome</th>
            <th className="p-2 text-left">Plano</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((org) => (
            <tr key={org.id} className="border-t">
              <td className="p-2">{org.name}</td>
              <td className="p-2">{org.plan || '-'}</td>
              <td className="p-2">{org.status}</td>
              <td className="p-2 space-x-2">
                <Link to={`/admin/orgs/${org.id}`} className="text-blue-600 hover:underline">Ver</Link>
                <Link
                  to={`/admin/organizations/${org.id}/history`}
                  className="btn btn-light"
                  style={{ marginLeft: 8 }}
                >
                  Histórico
                </Link>
                <button onClick={() => handleImpersonate(org)} className="text-blue-600 hover:underline">Impersonar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
