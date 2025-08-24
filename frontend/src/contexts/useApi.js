import axios from 'axios';

import api from "../api/api";
import { useAuth } from './AuthContext';

export function useApi() {
  const { token } = useAuth();
  const instance = axios.create({
    baseURL: '/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return instance;
}
