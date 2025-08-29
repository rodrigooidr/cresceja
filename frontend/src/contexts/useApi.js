

import inboxApi from "../api/inboxApi";
import { useAuth } from './AuthContext';

export function useApi() {
  const { token } = useAuth();
  const instance = inboxApi.create({
    baseURL: '/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return instance;
}
