import React, { useEffect, useState } from 'react';
import inboxApi, { listAdminOrgs } from "../api/inboxApi";
import { useAuth } from "../contexts/AuthContext";
import { hasGlobalRole } from "../auth/roles";

async function loadAdminOrgs(status = "active") {
  const res = await listAdminOrgs(status);
  const data = res?.data;
  const raw = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
    ? data
    : [];
  return raw.map((org) => ({
    id: org.id,
    name: org.name ?? org.company?.name ?? "Org",
    slug: org.slug ?? org.handle ?? null,
  }));
}

export default function WorkspaceSwitcher({ collapsed = false }) {
  const [orgs, setOrgs] = useState([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return; // sem token, não busca orgs

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const isGlobalAdmin = hasGlobalRole(['SuperAdmin', 'Support'], user);
        if (isGlobalAdmin) {
          const mapped = await loadAdminOrgs('active');
          if (!alive) return;
          const storedCurrent = localStorage.getItem('org_id') || localStorage.getItem('active_org_id') || '';
          const nextCurrent = storedCurrent || (mapped[0]?.id ?? '');
          setOrgs(mapped);
          setCurrent(nextCurrent);
          if (nextCurrent) localStorage.setItem('org_id', nextCurrent);
        } else {
          const { data } = await inboxApi.get('/orgs/me');
          if (!alive) return;

          const list = Array.isArray(data?.orgs) ? data.orgs : [];
          const curr = data?.currentOrgId || '';

          setOrgs(list);
          setCurrent(curr);
          if (curr) localStorage.setItem('org_id', curr);
        }
      } catch {
        if (alive) {
          setOrgs([]);
          setCurrent('');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user]);

  const handleChange = async (e) => {
    const orgId = e.target.value;
    setCurrent(orgId);
    localStorage.setItem('org_id', orgId); // mantém WS e outras áreas em sincronia
    try {
      await inboxApi.post('/orgs/switch', { orgId });
    } catch {
      // ignora erros: a página vai recarregar de qualquer jeito
    }
    // força recarregar pra aplicar org/rls globalmente
    window.location.reload();
  };

  // não renderiza sem token ou enquanto carrega, ou se só existe 0/1 organização
  if (!localStorage.getItem('token')) return null;
  if (loading) return null;
  if (!orgs?.length || orgs.length <= 1) return null;

  return (
    <select
      value={current}
      onChange={handleChange}
      className="w-full border rounded px-2 py-1 text-sm"
      aria-label="Selecionar organização"
    >
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {collapsed ? (org.name?.charAt(0) ?? '?') : org.name}
        </option>
      ))}
    </select>
  );
}

