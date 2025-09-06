diff --git a/frontend/jest.config.cjs b/frontend/jest.config.cjs
index 3b2f2f1..9bfa6b3 100644
--- a/frontend/jest.config.cjs
+++ b/frontend/jest.config.cjs
@@ -1,8 +1,9 @@
 module.exports = {
   testEnvironment: 'jsdom',
-  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
+  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
   moduleNameMapper: {
     '^api/(.*)$': '<rootDir>/src/api/$1',
     '^inbox/(.*)$': '<rootDir>/src/inbox/$1',
+    '^ui/(.*)$': '<rootDir>/src/ui/$1',
     '\\.(css|scss)$': 'identity-obj-proxy',
   },
 };
diff --git a/frontend/src/test/setupTests.ts b/frontend/src/test/setupTests.ts
new file mode 100644
index 0000000..0d6f0f1
--- /dev/null
+++ b/frontend/src/test/setupTests.ts
@@ -0,0 +1,62 @@
+// frontend/src/test/setupTests.ts
+import '@testing-library/jest-dom';
+
+// Polyfills úteis no JSDOM
+if (!('createObjectURL' in URL)) {
+  // @ts-ignore
+  URL.createObjectURL = jest.fn(() => 'blob://mock');
+}
+if (!('scrollTo' in window)) {
+  // @ts-ignore
+  window.scrollTo = jest.fn();
+}
+
+// Mock global do PopoverPortal (evita erro de portal/dom)
+jest.mock('ui/PopoverPortal', () => ({
+  __esModule: true,
+  default: ({ open, children }: any) => (open ? <div data-testid="popover-portal">{children}</div> : null),
+}));
+
+// Mock global do inboxApi — se algum teste precisar sobrescrever, use mockResolvedValueOnce nele.
+jest.mock('api/inboxApi', () => {
+  const makeResp = (over: any = {}) => ({ data: { items: [], ...over } });
+  const api = {
+    get: jest.fn(async () => makeResp()),
+    post: jest.fn(async () => makeResp()),
+    put: jest.fn(async () => makeResp()),
+    delete: jest.fn(async () => makeResp()),
+    request: jest.fn(async () => makeResp()),
+    // axios-like compat
+    interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
+    defaults: { headers: { common: {} as any } },
+    create: jest.fn(() => api),
+  };
+  const helpers = {
+    setAuthToken: jest.fn(),
+    clearAuthToken: jest.fn(),
+    apiUrl: 'http://localhost:4000/api',
+  };
+  return { __esModule: true, default: api, ...helpers };
+});
+
+// Alguns testes esperam Date fixa
+const realDate = Date;
+beforeAll(() => {
+  const fixed = new Date('2024-01-01T12:00:00.000Z');
+  // @ts-ignore
+  global.Date = class extends Date {
+    constructor(...args: any[]) {
+      // @ts-ignore
+      return args.length ? new realDate(...args) : new realDate(fixed);
+    }
+    static now() { return fixed.getTime(); }
+    static UTC = realDate.UTC;
+    static parse = realDate.parse;
+  } as any;
+});
+afterAll(() => {
+  // @ts-ignore
+  global.Date = realDate;
+});
diff --git a/frontend/src/api/__mocks__/inboxApi.js b/frontend/src/api/__mocks__/inboxApi.js
index 1f2a3cd..2a4f9b1 100644
--- a/frontend/src/api/__mocks__/inboxApi.js
+++ b/frontend/src/api/__mocks__/inboxApi.js
@@ -1,5 +1,31 @@
-export default {
-  get: jest.fn(async () => ({ data: {} })),
-  post: jest.fn(async () => ({ data: {} })),
-};
+// Mock robusto do axios instance usado como inboxApi
+const makeResp = (over = {}) => ({ data: { items: [], ...over } });
+
+const api = {
+  get: jest.fn(async () => makeResp()),
+  post: jest.fn(async () => makeResp()),
+  put: jest.fn(async () => makeResp()),
+  delete: jest.fn(async () => makeResp()),
+  request: jest.fn(async () => makeResp()),
+  // compatibilidade axios
+  interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
+  defaults: { headers: { common: {} } },
+  create: jest.fn(() => api),
+};
+
+export const setAuthToken = jest.fn();
+export const clearAuthToken = jest.fn();
+export const apiUrl = 'http://localhost:4000/api';
+
+export default api;
