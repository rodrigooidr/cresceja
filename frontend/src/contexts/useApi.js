import axios from 'axios';
import { useAuth } from './AuthContext';

export function useApi() {
  const { token } = useAuth();

  const api = axios.create({
    baseURL: 'http://localhost:4000/api',
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined
    }
  });

  return api;
}