import React, { useEffect, useState } from 'react';
import { adminListOrgs, getImpersonateOrgId, setImpersonateOrgId } from 'api/inboxApi';

export default function OrgSelector({ onChanged }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [value, setValue] = useState(getImpersonateOrgId());

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await adminListOrgs({ status: 'active' });
        if (!mounted) return;
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.orgs)
          ? data.orgs
          : Array.isArray(data)
          ? data
          : [];
        setOrgs(list);
      } catch (e) {
        setError('Falha ao carregar sua organização.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const onChange = (e) => {
    const next = e.target.value || '';
    setValue(next);
    setImpersonateOrgId(next);
    onChanged?.(next);
  };

  return (
    <div className="mb-3 flex items-center gap-3">
      <label className="text-sm text-gray-600">Cliente:</label>
      {loading ? (
        <span className="text-sm text-gray-500">carregando…</span>
      ) : error ? (
        <span className="text-sm text-red-600">{error}</span>
      ) : (
        <select
          value={value}
          onChange={onChange}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">— escolher —</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      {value && (
        <button
          type="button"
          className="text-xs text-blue-600 underline"
          onClick={() => { setValue(''); setImpersonateOrgId(''); onChanged?.(''); }}
        >
          limpar
        </button>
      )}
    </div>
  );
}

