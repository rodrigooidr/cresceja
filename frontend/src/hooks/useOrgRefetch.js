import { useEffect } from 'react';
import { useOrg } from '../contexts/OrgContext';
export default function useOrgRefetch(refetchFn, deps = []) {
  const { orgChangeTick } = useOrg();
  useEffect(() => { refetchFn?.(); }, deps);
  useEffect(() => { refetchFn?.(); }, [orgChangeTick]);
}
