import { useOrg } from "../contexts/OrgContext.jsx";

export default function useActiveOrg() {
  const { selected } = useOrg?.() ?? { selected: null };
  return { activeOrg: selected };
}
