import inboxApi from '@/api/inboxApi';

export async function fetchMyOrganizations() {
  const { data } = await inboxApi.get('/api/orgs/me', {
    meta: { scope: 'global' },
  });
  return Array.isArray(data?.items) ? data.items : [];
}

export async function fetchAdminOrganizations({ status = 'active' } = {}) {
  const { data } = await inboxApi.get('/api/admin/orgs', {
    params: status ? { status } : {},
    meta: { scope: 'global' },
  });
  return Array.isArray(data?.items) ? data.items : [];
}

export async function fetchAdminOrganization(orgId) {
  if (!orgId) return null;
  const { data } = await inboxApi.get(`/api/admin/orgs/${orgId}`, {
    meta: { scope: 'global' },
  });
  return data?.organization ?? null;
}

export async function createAdminOrganization(payload) {
  const { data } = await inboxApi.post('/api/admin/orgs', payload, {
    meta: { scope: 'global' },
  });
  return data?.organization ?? null;
}

export async function updateAdminOrganization(orgId, payload) {
  if (!orgId) throw new Error('orgId_required');
  const { data } = await inboxApi.patch(`/api/admin/orgs/${orgId}`, payload, {
    meta: { scope: 'global' },
  });
  return data?.organization ?? null;
}

export async function deleteAdminOrganization(orgId) {
  if (!orgId) return;
  await inboxApi.delete(`/api/admin/orgs/${orgId}`, {
    meta: { scope: 'global' },
  });
}
