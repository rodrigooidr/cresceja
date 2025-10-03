import React, { useEffect, useState } from 'react';
import inboxApi, { setActiveOrg } from 'api/inboxApi';
import { getOrgIdFromStorage } from '../services/session.js';

export default function OrgSwitcher({ onChange }) {
  const [orgs, setOrgs] = useState([]);
  const [sel, setSel] = useState(() => getOrgIdFromStorage() || '');

  useEffect(() => {
    inboxApi
      .get('/orgs?limit=200')
      .then(({ data }) => {
        setOrgs(data?.items || []);
      })
      .catch(() => setOrgs([]));
  }, []);

  const apply = (id) => {
    setSel(id);
    setActiveOrg(id);
    onChange?.(id);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Cliente:</span>
      <select
        value={sel}
        onChange={(e) => apply(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
        data-testid="org-switcher"
      >
        <option value="">— escolher —</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name || o.id} ({String(o.id).slice(0, 8)})
          </option>
        ))}
      </select>
    </div>
  );
}

