// frontend/src/api/http.js  (exemplo)
import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const orgId  = localStorage.getItem('orgId');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (orgId)  config.headers['X-Org-Id'] = orgId;
  return config;
});

export default http;
