// frontend/src/api/orgsApi.js  (não-admin)
import http from '@/api/http';

export async function listMyOrgs(status = 'active') {
  const { data } = await http.get(`/orgs`, { params: { status } });
  return data.items || [];
}
