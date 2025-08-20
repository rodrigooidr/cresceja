import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function WorkspaceSwitcher({ collapsed = false }) {
  const [orgs, setOrgs] = useState([]);
  const [current, setCurrent] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/orgs/me');
        if (!alive) return;
        setOrgs(data?.orgs || []);
        setCurrent(data?.currentOrgId || '');
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleChange = async (e) => {
    const orgId = e.target.value;
    setCurrent(orgId);
    try {
      await axios.post('/api/orgs/switch', { orgId });
      window.location.reload();
    } catch {
      // ignore errors
    }
  };

  if (orgs.length <= 1) return null;

  return (
    <select
      value={current}
      onChange={handleChange}
      className="w-full border rounded px-2 py-1 text-sm"
    >
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {collapsed ? org.name.charAt(0) : org.name}
        </option>
      ))}
    </select>
  );
}
