import { useEffect } from 'react';
import { useOrg } from '../contexts/OrgContext';

export default function useOrgRefetch(refetchFn, deps = []) {
  const { orgChangeTick } = useOrg();

  useEffect(() => {
    const cleanup = refetchFn?.();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [refetchFn, ...deps]);

  useEffect(() => {
    refetchFn?.();
  }, [orgChangeTick, refetchFn]);
}
