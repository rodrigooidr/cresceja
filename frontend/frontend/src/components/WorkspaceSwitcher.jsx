import React, { useEffect, useMemo, useState } from 'react';
import { adminListOrgs, getMyOrgs, switchOrg } from '@/api/inboxApi';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOrgIdFromStorage,
  getTokenFromStorage,
  setOrgIdInStorage,
} from '@/services/session.js';

export default function WorkspaceSwitcher({ collapsed = false }) {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: me } = useAuth();

  const roleSet = useMemo(() => {
    const roles = new Set();
    if (Array.isArray(me?.roles)) {
      for (const role of me.roles) {
        if (role) roles.add(role);
      }
    }
    if (me?.role) roles.add(me.role);
    return roles;
  }, [me]);

  const isGlobalAdmin = roleSet.has('SuperAdmin') || roleSet.has('Support');

  useEffect(() => {
    const token = getTokenFromStorage();
    if (!token) return; // sem token, não busca orgs

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        let payload;
        if (isGlobalAdmin) {
          const orgs = await adminListOrgs({ status: 'all' });
          payload = {
            currentOrgId: null,
            orgs,
          };
        } else {
          payload = await getMyOrgs();
        }
        if (!alive) return;

        const rawOrgs = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.orgs)
          ? payload.orgs
          : Array.isArray(payload)
          ? payload
          : [];

        const mapped = rawOrgs.map((org) => ({
          id: org.id,
          name: org.name ?? org.razao_social ?? 'Org',
          slug: org.slug ?? null,
        }));
        const storedCurrent = getOrgIdFromStorage() || '';
        const nextCurrent =
          storedCurrent || payload?.currentOrgId || (mapped[0]?.id ?? '');
        setItems(mapped);
        setCurrent(nextCurrent);
        if (nextCurrent) {
          setOrgIdInStorage(nextCurrent);
        }
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
  }, [isGlobalAdmin, me?.id]);

  const handleChange = async (e) => {
    const orgId = e.target.value;
    setCurrent(orgId);
    if (orgId) {
      setOrgIdInStorage(orgId);
    }
    try {
      await switchOrg(orgId);
    } catch {
      // ignora erros: a página vai recarregar de qualquer jeito
    }
    // força recarregar pra aplicar org/rls globalmente
    window.location.reload();
  };

  // não renderiza sem token ou enquanto carrega, ou se só existe 0/1 organização
  if (!getTokenFromStorage()) return null;
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

