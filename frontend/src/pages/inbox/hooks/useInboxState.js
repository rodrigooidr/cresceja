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
const role = user?.role || 'unknown';
const isAdminRole = ['super_admin', 'SuperAdmin', 'org_admin', 'OrgOwner'].includes(role);
const orgIdFromUrl = searchParams.get('org_id') || null;
const unknownRole = !['agent','supervisor','org_admin','super_admin','manager','OrgOwner','SuperAdmin'].includes(role);
const can = useCallback((action) => {
const map = {
read: ['agent','supervisor','org_admin','super_admin','manager','OrgOwner','SuperAdmin'],
assign: ['agent','supervisor','org_admin','super_admin','manager','OrgOwner','SuperAdmin'],
archive: ['supervisor','org_admin','super_admin','manager','OrgOwner','SuperAdmin'],
close: ['supervisor','org_admin','super_admin','manager','OrgOwner','SuperAdmin'],
spam: ['org_admin','super_admin','SuperAdmin'],
};
const allowed = map[action] ? map[action].includes(role) : true;
return unknownRole ? false : allowed;
}, [role, unknownRole]);


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