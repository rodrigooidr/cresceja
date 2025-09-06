// Mock robusto do axios instance usado como inboxApi
const makeResp = (over = {}) => ({ data: { items: [], ...over } });

const api = {
  get: jest.fn(async () => makeResp()),
  post: jest.fn(async () => makeResp()),
  put: jest.fn(async () => makeResp()),
  delete: jest.fn(async () => makeResp()),
  request: jest.fn(async () => makeResp()),
  // compatibilidade axios
  interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
  defaults: { headers: { common: {} } },
  create: jest.fn(() => api),
};

export const setAuthToken = jest.fn();
export const clearAuthToken = jest.fn();
export const apiUrl = 'http://localhost:4000/api';

export default api;

