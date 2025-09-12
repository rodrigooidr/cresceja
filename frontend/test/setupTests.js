import "@testing-library/jest-dom";

jest.mock("../src/api/inboxApi", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: { items: [] } })),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
