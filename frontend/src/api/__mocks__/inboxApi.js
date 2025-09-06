export default {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
};
export const setAuthToken = jest.fn();
export const clearAuthToken = jest.fn();
export const getAuthToken = jest.fn(() => null);
