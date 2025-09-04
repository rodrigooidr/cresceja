import '@testing-library/jest-dom';
import { server } from './test/msw/server';

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
