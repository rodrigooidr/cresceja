const makeResp = (over = {}) => ({ data: { items: [], ...over } });

const api = {
  get: jest.fn(async (url, cfg) => {
    if (url?.includes('/inbox/conversations')) {
      return { data: { items: [
        { id: 'c1', name: 'Alice', last_message_at: '2024-01-01T12:00:00Z', updated_at: '2024-01-01T12:00:00Z' },
        { id: 'c2', name: 'Bob', last_message_at: '2024-01-01T11:00:00Z', updated_at: '2024-01-01T11:00:00Z' },
      ], total: 2 } };
    }
    return makeResp();
  }),
  post: jest.fn(async () => makeResp()),
  put: jest.fn(async () => makeResp()),
  delete: jest.fn(async () => makeResp()),
  request: jest.fn(async () => makeResp()),
  interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
  defaults: { headers: { common: {} } },
  create: jest.fn(() => api),
};

export const setAuthToken = jest.fn();
export const clearAuthToken = jest.fn();
export const apiUrl = 'http://localhost:4000/api';

export default api;
