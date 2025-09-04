// frontend/src/setupTests.js
require('@testing-library/jest-dom');
require('whatwg-fetch');

// crypto.randomUUID usado no InboxPage
if (!global.crypto?.randomUUID) {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto;
}

// TextEncoder/Decoder para libs que convertem binários
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

if (!global.TransformStream) {
  const { TransformStream } = require('stream/web');
  global.TransformStream = TransformStream;
}
if (!global.ReadableStream) {
  const { ReadableStream, WritableStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
}

// FormData / File / Blob (uploads em testes)
try {
  const { fetch, Request, Response, Headers, FormData, File, Blob } = require('undici');
  global.fetch = global.fetch || fetch;
  global.Request = global.Request || Request;
  global.Response = global.Response || Response;
  global.Headers = global.Headers || Headers;
  global.FormData = global.FormData || FormData;
  global.File = global.File || File;
  global.Blob = global.Blob || Blob;
} catch {}

// Stubs úteis para libs de UI
global.ResizeObserver = global.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
URL.createObjectURL = URL.createObjectURL || (() => 'blob://test');

// --- MSW (mocks para os endpoints usados no Inbox) ---
const { server } = require('./test/msw/server');

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
