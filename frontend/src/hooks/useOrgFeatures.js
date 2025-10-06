import { useEffect, useState } from 'react';
import api from '../api/inboxApi';
import { useOrg } from '../contexts/OrgContext';

export default function useOrgFeatures() {
  const { selected } = useOrg();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!selected) {
      setFeatures({});
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);

    (async () => {
      try {
        const { data } = await api.get(`/orgs/${selected}/features`, { meta: { scope: 'global' } });
        if (!active) return;
        setFeatures(data?.features || {});
      } catch (e) {
        if (!active) return;
        setFeatures({});
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selected]);

  return { features, loading };
}
