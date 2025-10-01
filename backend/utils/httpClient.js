import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 2;
const BASE_BACKOFF_MS = 250;

export class HttpClientError extends Error {
  constructor(message, { status, data, cause, isTimeout = false } = {}) {
    super(message);
    this.name = 'HttpClientError';
    this.status = status ?? null;
    this.data = data;
    this.cause = cause;
    this.isTimeout = Boolean(isTimeout);
  }
}

async function doFetch(url, { method = 'GET', headers, body, timeout = DEFAULT_TIMEOUT, signal }) {
  const controller = new AbortController();
  const signals = [];
  if (signal) signals.push(signal);
  signals.push(controller.signal);
  const mergedSignal =
    signals.length > 1 && typeof AbortSignal?.any === 'function'
      ? AbortSignal.any(signals)
      : signals[0];
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: mergedSignal,
    });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new HttpClientError('Tempo limite excedido ao contatar provedor', {
        status: 504,
        cause: error,
        isTimeout: true,
      });
    }
    throw new HttpClientError('Falha de rede ao contatar provedor', {
      cause: error,
    });
  }
}

function pickSummary(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) return data.error.message;
  return null;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function httpRequest(url, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    backoffBase = BASE_BACKOFF_MS,
    logger = null,
    signal,
  } = options;

  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      const response = await doFetch(url, { method, headers, body, timeout, signal });
      if (response.ok) {
        const data = await parseBody(response);
        return { status: response.status, data, headers: response.headers };
      }
      const data = await parseBody(response);
      const summary = pickSummary(data) || response.statusText || 'Erro ao contatar provedor';
      throw new HttpClientError(summary, { status: response.status, data });
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof HttpClientError &&
        (err.status === null || (err.status >= 500 && err.status < 600) || err.isTimeout);
      if (!retryable || attempt === retries) {
        throw err;
      }
      const waitMs = Math.round(backoffBase * Math.pow(2, attempt));
      logger?.warn?.({ msg: 'http_client_retry', attempt: attempt + 1, waitMs, url });
      await delay(waitMs, undefined, { signal });
      attempt += 1;
    }
  }
  throw lastError;
}

function makeBody(payload) {
  if (payload == null) return undefined;
  if (typeof payload === 'string' || payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
    return payload;
  }
  return JSON.stringify(payload);
}

function ensureHeaders(headers, hasBody) {
  const base = { ...(headers || {}) };
  if (hasBody) {
    const lower = new Set(Object.keys(base).map((key) => key.toLowerCase()));
    if (!lower.has('content-type')) {
      base['Content-Type'] = 'application/json';
    }
  }
  return base;
}

export const httpClient = {
  async request(url, options = {}) {
    return httpRequest(url, options);
  },
  async get(url, options = {}) {
    return httpRequest(url, { ...options, method: 'GET' });
  },
  async post(url, payload, options = {}) {
    const body = makeBody(payload);
    const headers = ensureHeaders(options.headers, body !== undefined);
    return httpRequest(url, { ...options, method: 'POST', body, headers });
  },
  async put(url, payload, options = {}) {
    const body = makeBody(payload);
    const headers = ensureHeaders(options.headers, body !== undefined);
    return httpRequest(url, { ...options, method: 'PUT', body, headers });
  },
  async patch(url, payload, options = {}) {
    const body = makeBody(payload);
    const headers = ensureHeaders(options.headers, body !== undefined);
    return httpRequest(url, { ...options, method: 'PATCH', body, headers });
  },
  async delete(url, options = {}) {
    return httpRequest(url, { ...options, method: 'DELETE' });
  },
};

export default httpClient;
