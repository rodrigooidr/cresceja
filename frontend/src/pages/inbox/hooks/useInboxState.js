// src/pages/inbox/hooks/useInboxState.js
const [filters, setFilters] = useState({
search: searchParams.get('search') || searchParams.get('q') || '',
channels: (searchParams.get('channels') || searchParams.get('channel') || '').split(',').filter(Boolean),
tags: (searchParams.get('tags') || '').split(',').filter(Boolean),
status: (searchParams.get('status') || '').split(',').filter(Boolean),
});


// role/capabilities
const user = useMemo(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); }
  catch { return {}; }
}, []);
const normalizeRole = (raw) => {
  if (!raw) return 'Unknown';
  const key = String(raw).toLowerCase();
  const map = {
    agent: 'OrgAgent',
    orgagent: 'OrgAgent',
    supervisor: 'OrgAdmin',
    manager: 'OrgAdmin',
    orgadmin: 'OrgAdmin',
    orgowner: 'OrgOwner',
    owner: 'OrgOwner',
    orgviewer: 'OrgViewer',
    viewer: 'OrgViewer',
    support: 'Support',
    superadmin: 'SuperAdmin',
  };
  return map[key] || raw;
};
const role = normalizeRole(user?.role);
const orgIdFromUrl = searchParams.get('org_id') || null;
const knownRoles = ['OrgViewer', 'OrgAgent', 'OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'];
const isAdminRole = ['OrgAdmin', 'OrgOwner', 'SuperAdmin'].includes(role);
const unknownRole = !knownRoles.includes(role);
const abilities = useMemo(() => ({
  read: ['OrgAgent', 'OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'],
  assign: ['OrgAgent', 'OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'],
  archive: ['OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'],
  close: ['OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'],
  spam: ['OrgAdmin', 'Support', 'SuperAdmin'],
}), []);
const can = useCallback((action) => {
  if (unknownRole) return false;
  const allowed = abilities[action];
  if (!allowed) return true;
  return allowed.includes(role);
}, [abilities, role, unknownRole]);


const [selectedIds, setSelectedIds] = useState(() => new Set());
const onToggleSelect = useCallback((id) => {
setSelectedIds((prev) => {
const nxt = new Set(prev);
if (nxt.has(id)) nxt.delete(id); else nxt.add(id);
return nxt;
});
}, []);


const [toastError, setToastError] = useState('');
const showError = useCallback((msg) => {
setToastError(msg || 'Erro');
setTimeout(() => setToastError(''), 4000);
}, []);


const [density, setDensity] = useState(() => localStorage.getItem('cj:inbox:density') || 'cozy');
const toggleDensity = () => {
const next = density === 'compact' ? 'cozy' : 'compact';
setDensity(next);
try { localStorage.setItem('cj:inbox:density', next); } catch {}
};


return {
panel,
setPanel,
filters,
setFilters,
can,
selectedIds,
setSelectedIds,
onToggleSelect,
showError,
density,
toggleDensity,
isAdminRole,
orgIdFromUrl,
};
}