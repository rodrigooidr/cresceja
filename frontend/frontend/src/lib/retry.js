function createAbortError() {
  try {
    return new DOMException('Aborted', 'AbortError');
  } catch (err) {
    const fallback = new Error('Aborted');
    fallback.name = 'AbortError';
    return fallback;
  }
}

export function sleep(ms, { signal } = {}) {
  const duration = Math.max(0, Number(ms) || 0);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, duration);

    function cleanup() {
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
    }

    function onAbort() {
      clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

// opts: { retries=3, baseMs=200, maxMs=2000, factor=2, jitter=true, signal, onAttempt, classify }
export async function retry(fn, opts = {}) {
  const {
    retries = 3,
    baseMs = 200,
    maxMs = 2000,
    factor = 2,
    jitter = true,
    signal,
    onAttempt,
    classify = () => true,
  } = opts;

  const parsedRetries = Number(retries);
  const totalRetries = Number.isFinite(parsedRetries) ? Math.max(0, Math.trunc(parsedRetries)) : 0;
  const parsedBase = Number(baseMs);
  const baseDelay = Number.isFinite(parsedBase) ? Math.max(0, parsedBase) : 0;
  const parsedMax = Number(maxMs);
  const maxDelayCandidate = Number.isFinite(parsedMax) ? Math.max(0, parsedMax) : 0;
  const maxDelay = Math.max(baseDelay, maxDelayCandidate);
  const parsedFactor = Number(factor);
  const growthFactor = Number.isFinite(parsedFactor) && parsedFactor > 0 ? parsedFactor : 2;

  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw createAbortError();
    try {
      onAttempt?.(attempt);
      return await fn({ attempt });
    } catch (err) {
      if (signal?.aborted) throw createAbortError();
      const shouldRetry = classify(err, { attempt, retries: totalRetries });
      attempt += 1;
      if (attempt > totalRetries || !shouldRetry) {
        throw err;
      }
      let delay = Math.min(maxDelay, baseDelay * Math.pow(growthFactor, attempt - 1));
      if (jitter && delay > 0) {
        const jitterFactor = 0.5 + Math.random();
        delay = Math.floor(delay * jitterFactor);
      }
      await sleep(delay, { signal });
    }
  }
}
