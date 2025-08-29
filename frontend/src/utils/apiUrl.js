// src/lib/apiUrl.js
export const BASE_API_URL = (() => {
  let base =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  base = (base || '').replace(/\/+$/, '');
  if (!/\/api$/.test(base)) base = `${base}/api`;
  return base;
})();

export function apiUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = BASE_API_URL.replace(/\/+$/, '');
  const rel = String(path).replace(/^\/+/, '');
  return `${base}/${rel}`;
}

export default apiUrl;
