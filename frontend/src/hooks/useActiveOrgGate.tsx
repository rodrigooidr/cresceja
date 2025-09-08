import { useOrg } from '../contexts/OrgContext';

export default function useActiveOrgGate() {
  const { loading, selected, canSeeSelector } = useOrg();
  const ready = !loading && !!selected;
  const error = !loading && !selected
    ? (canSeeSelector ? 'Selecione uma organização no sidebar.' : 'Sem acesso a nenhuma organização.')
    : null;
  return { loading, selected, ready, error };
}
