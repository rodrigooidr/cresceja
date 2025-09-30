import React, { useEffect, useState } from 'react';
import { switchOrg } from '@/api/inboxApi';
import { fetchMyOrganizations } from '@/api/admin/orgsApi';
import { useAuth } from "@/contexts/AuthContext";

export default function WorkspaceSwitcher({ collapsed = false }) {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: me } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return; // sem token, não busca orgs

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const data = await fetchMyOrganizations();
        if (!alive) return;

        const list = Array.isArray(data) ? data : [];
        const mapped = list.map((org) => ({
          id: org.id,
          name: org.name ?? 'Org',
          slug: org.slug ?? null,
        }));
        const storedCurrent = localStorage.getItem('org_id') || localStorage.getItem('active_org_id') || '';
        const nextCurrent = storedCurrent || (mapped[0]?.id ?? '');
        setItems(mapped);
        setCurrent(nextCurrent);
        if (nextCurrent) localStorage.setItem('org_id', nextCurrent);
      } catch {
        if (alive) {
          setItems([]);
          setCurrent('');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [me]);

  const handleChange = async (e) => {
    const orgId = e.target.value;
    setCurrent(orgId);
    localStorage.setItem('org_id', orgId); // mantém WS e outras áreas em sincronia
    try {
      await switchOrg(orgId);
    } catch {
      // ignora erros: a página vai recarregar de qualquer jeito
    }
    // força recarregar pra aplicar org/rls globalmente
    window.location.reload();
  };

  // não renderiza sem token ou enquanto carrega, ou se só existe 0/1 organização
  if (!localStorage.getItem('token')) return null;
  if (loading) return null;
  if (!items?.length || items.length <= 1) return null;

  return (
    <select
      value={current}
      onChange={handleChange}
      className="w-full border rounded px-2 py-1 text-sm"
      aria-label="Selecionar organização"
    >
      {items.map((org) => (
        <option key={org.id} value={org.id}>
          {collapsed ? (org.name?.charAt(0) ?? '?') : org.name}
        </option>
      ))}
    </select>
  );
}

