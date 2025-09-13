import { useEffect, useState } from 'react';
import inboxApi from '../api/inboxApi';
import { useOrg } from '../contexts/OrgContext';

export default function useOrgFeatures() {
  const { selected } = useOrg();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) { setData(null); return; }
    setLoading(true);
    inboxApi.get(`/orgs/${selected}/features`, { meta:{ scope:'global' } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [selected]);

  return { features: data || {}, loading };
}
