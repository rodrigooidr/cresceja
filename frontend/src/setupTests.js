// frontend/src/setupTests.js
import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Polyfills úteis
if (!global.crypto?.randomUUID) {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto;
}
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
try {
  const { FormData, File, Blob } = require('undici');
  global.FormData = global.FormData || FormData;
  global.File = global.File || File;
  global.Blob = global.Blob || Blob;
} catch {}
global.ResizeObserver = global.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
URL.createObjectURL = URL.createObjectURL || (() => 'blob://test');

// MSW server centralizado
import { server } from './test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
