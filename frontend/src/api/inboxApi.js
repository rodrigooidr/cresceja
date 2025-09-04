import axios from "axios";

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';

const inboxApi = axios.create({ baseURL: API_BASE_URL });

inboxApi.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (!token) {
    // Evita requests sem token
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new axios.Cancel('No auth token');
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

inboxApi.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default inboxApi;
