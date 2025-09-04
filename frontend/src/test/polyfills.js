// Streams/Blob/Response/fetch/URL para jsdom
import 'web-streams-polyfill/dist/polyfill';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, TransformStream } from 'web-streams-polyfill/dist/ponyfill';
import { MessageChannel, MessagePort } from 'worker_threads';

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
if (!global.MessageChannel) global.MessageChannel = MessageChannel;
if (!global.MessagePort) global.MessagePort = MessagePort;

const { URL, URLSearchParams } = require('whatwg-url');
const { Blob, File, fetch, Headers, Request, Response } = require('undici');

if (!global.ReadableStream) global.ReadableStream = ReadableStream;
if (!global.TransformStream) global.TransformStream = TransformStream;
if (!global.Blob) global.Blob = Blob;
if (!global.File) global.File = File;
if (!global.fetch) global.fetch = fetch;
if (!global.Headers) global.Headers = Headers;
if (!global.Request) global.Request = Request;
if (!global.Response) global.Response = Response;
if (!global.URL) global.URL = URL;
if (!global.URLSearchParams) global.URLSearchParams = URLSearchParams;

// matchMedia (muito usado por libs de UI)
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// ResizeObserver (opcional, dependendo da UI)
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!window.ResizeObserver) window.ResizeObserver = RO;

// BroadcastChannel (algumas libs usam para tabs)
if (!('BroadcastChannel' in global)) {
  global.BroadcastChannel = class {
    constructor() {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    onmessage = null;
  };
}

if (!global.crypto) global.crypto = {};
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}
