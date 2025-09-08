import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import inboxApi, { setImpersonateOrgId } from '../../api/inboxApi';

export default function AdminOrgsList() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const res = await inboxApi.get('/api/admin/orgs', { params: { q, page, pageSize: 20 }, meta: { scope: 'global' } });
    setItems(res.data.items || []);
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = (org) => {
    setImpersonateOrgId(org.id);
    alert(`Agora você está atuando como ${org.name}`);
  };

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
                <button onClick={() => handleImpersonate(org)} className="text-blue-600 hover:underline">Impersonar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
