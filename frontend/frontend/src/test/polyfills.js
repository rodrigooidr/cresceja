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

// Base64 helpers
if (!global.atob) global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
if (!global.btoa) global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// createObjectURL / revokeObjectURL
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:http://localhost/fake';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

// FileReader
if (!global.FileReader) {
  global.FileReader = class {
    onload = null;
    onerror = null;
    readAsDataURL(blob) {
      const buf = Buffer.from('');
      const result = `data:${blob?.type || 'application/octet-stream'};base64,${buf.toString('base64')}`;
      setTimeout(() => this.onload && this.onload({ target: { result } }), 0);
    }
  };
}

// IntersectionObserver
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// DOMRect
if (!global.DOMRect) {
  global.DOMRect = class {
    constructor() {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        toJSON() {
          return this;
        }
      };
    }
  };
}

// scroll helpers
if (!window.scrollTo) window.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// Clipboard API
if (!navigator.clipboard) {
  navigator.clipboard = {
    writeText: async () => {},
    readText: async () => ''
  };
}

// structuredClone
if (!global.structuredClone) {
  global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}
