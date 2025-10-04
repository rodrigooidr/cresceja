import { useCallback, useEffect, useRef, useState } from 'react';
import inboxApi from '../../../api/inboxApi.js';
import { retry } from '../../../lib/retry.js';
import { newIdempotencyKey } from '../../../lib/idempotency.js';
import { track } from '../../../lib/analytics.js';
import { audit } from '../../../lib/audit.js';

const RETRY_DEFAULTS = {
  retries: 3,
  baseMs: 250,
  maxMs: 2000,
  factor: 2,
  jitter: true,
};

function toStatus(result, enabled) {
  if (!enabled) return 'idle';
  return result?.status === 'fulfilled' ? 'ok' : 'err';
}

function getErrorStatus(result) {
  if (!result || result.status !== 'rejected') return undefined;
  const reason = result.reason;
  return reason?.status ?? reason?.response?.status;
}

export default function useApproval({ api = inboxApi } = {}) {
  /**
   * @typedef {Object} ApproveResult
   * @property {boolean} ok
   * @property {boolean} [partial]
   * @property {'busy'|'abort'|'error'|'circuit-open'|'no-last-attempt'} [reason]
   * @property {number} [status]
   */
  const [approving, setApproving] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [state, setState] = useState({ job: 'idle', suggestion: 'idle', error: null });
  const lastAttempt = useRef(null);
  const inflight = useRef(null);
  const mounted = useRef(true);
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  useEffect(() => () => {
    mounted.current = false;
    inflight.current?.abort?.();
  }, []);

  const approveOne = useCallback(async ({ jobId, suggestionId, signal }) => {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    signal?.addEventListener?.('abort', forwardAbort, { once: true });
    if (signal?.aborted) {
      controller.abort();
    }
    try {
      const headers = { 'Idempotency-Key': newIdempotencyKey() };
      const classifyRetry = (err) => {
        const status = Number(err?.status ?? err?.response?.status);
        return err?.name !== 'AbortError' && [429, 502, 503, 504].includes(status);
      };

      const callJob = () => api.post(
        `/marketing/jobs/${jobId}/approve`,
        { jobId },
        { signal: controller.signal, headers }
      );

      const callSuggestion = () => api.post(
        `/marketing/suggestions/${suggestionId}/approve`,
        { suggestionId },
        { signal: controller.signal, headers }
      );

      track('marketing_approve_click', { jobId, suggestionId, mode: 'single-or-bulk' });

      const jobPromise = jobId
        ? retry(() => callJob(), {
            ...RETRY_DEFAULTS,
            signal: controller.signal,
            classify: classifyRetry,
            onAttempt: (attempt) =>
              track('marketing_approve_job_attempt', { jobId, attempt, bulk: !!signal }),
          })
        : Promise.resolve({ ok: true });

      const suggestionPromise = suggestionId
        ? retry(() => callSuggestion(), {
            ...RETRY_DEFAULTS,
            signal: controller.signal,
            classify: classifyRetry,
            onAttempt: (attempt) =>
              track('marketing_approve_suggestion_attempt', { suggestionId, attempt, bulk: !!signal }),
          })
        : Promise.resolve({ ok: true });

      const [jobRes, suggestionRes] = await Promise.allSettled([jobPromise, suggestionPromise]);

      const aborted = [jobRes, suggestionRes].some(
        (result) => result.status === 'rejected' && result.reason?.name === 'AbortError'
      );

      if (aborted) {
        track('marketing_approve_abort', { jobId, suggestionId, bulk: !!signal });
        await audit('marketing.approve.abort', { jobId, suggestionId, bulk: !!signal });
        return { ok: false, partial: false, reason: 'abort', jobStatus: 'idle', suggestionStatus: 'idle' };
      }

      const jobStatus = jobId ? toStatus(jobRes, true) : 'idle';
      const suggestionStatus = suggestionId ? toStatus(suggestionRes, true) : 'idle';
      const statuses = [jobStatus, suggestionStatus].filter((value) => value !== 'idle');

      if (statuses.every((value) => value === 'ok')) {
        track('marketing_approve_success', { jobId, suggestionId, test: !!isTestEnv, bulk: !!signal });
        await audit('marketing.approve.success', { jobId, suggestionId, bulk: !!signal });
        return { ok: true, partial: false, jobStatus, suggestionStatus };
      }

      if (statuses.some((value) => value === 'err')) {
        if (statuses.every((value) => value === 'err')) {
          const status = getErrorStatus(jobRes) ?? getErrorStatus(suggestionRes);
          track('marketing_approve_error', { jobId, suggestionId, status, bulk: !!signal });
          await audit('marketing.approve.error', { jobId, suggestionId, status, bulk: !!signal });
          return { ok: false, partial: false, reason: 'error', status, jobStatus, suggestionStatus };
        }

        track('marketing_approve_partial', { jobId, suggestionId, bulk: !!signal });
        await audit('marketing.approve.partial', { jobId, suggestionId, bulk: !!signal });
        return { ok: false, partial: true, jobStatus, suggestionStatus };
      }

      return { ok: true, partial: false, jobStatus, suggestionStatus };
    } catch (err) {
      if (err?.name === 'AbortError') {
        track('marketing_approve_abort', { jobId, suggestionId, bulk: !!signal });
        await audit('marketing.approve.abort', { jobId, suggestionId, bulk: !!signal });
        return { ok: false, partial: false, reason: 'abort', jobStatus: 'idle', suggestionStatus: 'idle' };
      }

      const status = err?.status ?? err?.response?.status;
      track('marketing_approve_error', { jobId, suggestionId, status, bulk: !!signal });
      await audit('marketing.approve.error', { jobId, suggestionId, status, bulk: !!signal });
      return {
        ok: false,
        partial: false,
        reason: 'error',
        status,
        jobStatus: jobId ? 'err' : 'idle',
        suggestionStatus: suggestionId ? 'err' : 'idle',
      };
    } finally {
      signal?.removeEventListener?.('abort', forwardAbort);
    }
  }, [api, isTestEnv]);

  /**
   * Executa a aprovação de um par (jobId, suggestionId).
   * @param {{ jobId?: string, suggestionId?: string, trackPayload?: any, jobIds?: string[], job?: any, suggestion?: any }} config
   * @returns {Promise<ApproveResult>}
   */
  const approve = useCallback(async (config = {}) => {
    if (approving) {
      return { ok: false, partial: false, reason: 'busy', jobStatus: 'idle', suggestionStatus: 'idle' };
    }

    const {
      jobId,
      suggestionId,
      trackPayload: providedTrackPayload,
      jobIds,
      job,
      suggestion,
    } = config || {};

    const jobConfig = job ?? (jobId ? { id: jobId } : null);
    const suggestionConfig = suggestion ?? (suggestionId ? { id: suggestionId } : null);

    const jobRequest = typeof jobConfig?.request === 'function'
      ? jobConfig.request
      : jobConfig?.id
        ? ({ signal, headers }) => api.post(
            `/marketing/jobs/${jobConfig.id}/approve`,
            jobConfig?.body ?? { jobId: jobConfig.id },
            { signal, headers }
          )
        : null;

    const suggestionRequest = typeof suggestionConfig?.request === 'function'
      ? suggestionConfig.request
      : suggestionConfig?.id
        ? ({ signal, headers }) => api.post(
            `/marketing/suggestions/${suggestionConfig.id}/approve`,
            suggestionConfig?.body ?? { suggestionId: suggestionConfig.id },
            { signal, headers }
          )
        : null;

    const jobRetry = jobConfig?.retry;
    const suggestionRetry = suggestionConfig?.retry;

    const trackPayload = providedTrackPayload ?? {
      jobId: jobConfig?.id ?? null,
      jobIds,
      suggestionId: suggestionConfig?.id ?? null,
    };

    const auditBasePayload = {
      jobId: trackPayload?.jobId ?? jobConfig?.id ?? jobId ?? null,
      suggestionId: trackPayload?.suggestionId ?? suggestionConfig?.id ?? suggestionId ?? null,
    };
    const auditJobIds = Array.isArray(trackPayload?.jobIds)
      ? trackPayload.jobIds
      : Array.isArray(jobIds)
        ? jobIds
        : undefined;
    if (Array.isArray(auditJobIds)) {
      auditBasePayload.jobIds = auditJobIds;
      if (auditBasePayload.jobIds.length > 1) {
        auditBasePayload.bulk = true;
      }
    }
    if (typeof trackPayload?.bulk !== 'undefined') {
      auditBasePayload.bulk = !!trackPayload.bulk;
    }
    const buildAuditPayload = (extra = {}) => ({ ...auditBasePayload, ...extra });

    const shouldApproveJob = Boolean(jobRequest);
    const shouldApproveSuggestion = Boolean(suggestionRequest);

    const controller = new AbortController();
    inflight.current?.abort?.();
    inflight.current = controller;

    const headers = { 'Idempotency-Key': newIdempotencyKey() };

    const classifyRetry = (err) => {
      const status = Number(err?.status ?? err?.response?.status);
      return err?.name !== 'AbortError' && [429, 502, 503, 504].includes(status);
    };

    const snapshot = {
      job: shouldApproveJob ? { request: jobRequest, retry: jobRetry } : null,
      suggestion: shouldApproveSuggestion ? { request: suggestionRequest, retry: suggestionRetry } : null,
      trackPayload: { ...trackPayload },
    };
    lastAttempt.current = snapshot;

    if (mounted.current) {
      setApproving(true);
      setState({
        job: shouldApproveJob ? 'pending' : 'idle',
        suggestion: shouldApproveSuggestion ? 'pending' : 'idle',
        error: null,
      });
    }

    track('marketing_approve_click', trackPayload);

    try {
      const jobPromise = shouldApproveJob
        ? retry(
            () => jobRequest({ signal: controller.signal, headers }),
            {
              ...RETRY_DEFAULTS,
              signal: controller.signal,
              classify: classifyRetry,
              onAttempt: (attempt) =>
                track('marketing_approve_job_attempt', { ...trackPayload, attempt }),
              ...jobRetry,
            }
          )
        : Promise.resolve({ ok: true });

      const suggestionPromise = shouldApproveSuggestion
        ? retry(
            () => suggestionRequest({ signal: controller.signal, headers }),
            {
              ...RETRY_DEFAULTS,
              signal: controller.signal,
              classify: classifyRetry,
              onAttempt: (attempt) =>
                track('marketing_approve_suggestion_attempt', { ...trackPayload, attempt }),
              ...suggestionRetry,
            }
          )
        : Promise.resolve({ ok: true });

      const [jobRes, suggestionRes] = await Promise.allSettled([jobPromise, suggestionPromise]);

      const aborted = [jobRes, suggestionRes].some(
        (result) => result.status === 'rejected' && result.reason?.name === 'AbortError'
      );

      if (aborted) {
        track('marketing_approve_abort', trackPayload);
        await audit('marketing.approve.abort', buildAuditPayload());
        return { ok: false, partial: false, reason: 'abort', jobStatus: 'idle', suggestionStatus: 'idle' };
      }

      const jobStatus = toStatus(jobRes, shouldApproveJob);
      const suggestionStatus = toStatus(suggestionRes, shouldApproveSuggestion);
      const statuses = [jobStatus, suggestionStatus].filter((value) => value !== 'idle');

      let errorType = null;
      if (statuses.some((value) => value === 'err')) {
        errorType = statuses.every((value) => value === 'err') ? 'full' : 'partial';
      }

      if (mounted.current) {
        setState({ job: jobStatus, suggestion: suggestionStatus, error: errorType });
      }

      const status = getErrorStatus(jobRes) ?? getErrorStatus(suggestionRes);

      if (!errorType) {
        track('marketing_approve_success', { ...trackPayload, test: !!isTestEnv });
        await audit('marketing.approve.success', buildAuditPayload());
        return { ok: true, partial: false, jobStatus, suggestionStatus };
      }

      if (errorType === 'partial') {
        track('marketing_approve_partial', trackPayload);
        await audit('marketing.approve.partial', buildAuditPayload());
        return { ok: false, partial: true, jobStatus, suggestionStatus, status };
      }

      track('marketing_approve_error', { ...trackPayload, status });
      await audit('marketing.approve.error', buildAuditPayload({ status }));
      return { ok: false, partial: false, reason: 'error', status, jobStatus, suggestionStatus };
    } catch (err) {
      if (err?.name === 'AbortError') {
        track('marketing_approve_abort', trackPayload);
        await audit('marketing.approve.abort', buildAuditPayload());
        return { ok: false, partial: false, reason: 'abort', jobStatus: 'idle', suggestionStatus: 'idle' };
      }

      if (mounted.current) {
        setState((prev) => ({ ...prev, error: 'full' }));
      }

      const status = err?.status ?? err?.response?.status;
      track('marketing_approve_error', { ...trackPayload, status });
      await audit('marketing.approve.error', buildAuditPayload({ status }));
      return {
        ok: false,
        partial: false,
        reason: 'error',
        status,
        jobStatus: shouldApproveJob ? 'err' : 'idle',
        suggestionStatus: shouldApproveSuggestion ? 'err' : 'idle',
      };
    } finally {
      if (mounted.current) {
        setApproving(false);
      }
      if (inflight.current === controller) {
        inflight.current = null;
      }
    }
  }, [api, approving, isTestEnv]);

  const retryApprove = useCallback(() => {
    if (lastAttempt.current) {
      return approve(lastAttempt.current);
    }
    return { ok: false, partial: false, reason: 'no-last-attempt', jobStatus: 'idle', suggestionStatus: 'idle' };
  }, [approve]);

  const abort = useCallback(() => {
    const controller = inflight.current;
    controller?.abort?.();
  }, []);

  const approveMany = useCallback(({ items = [], concurrency = 3, onProgress, onItem } = {}) => {
    if (!Array.isArray(items) || items.length === 0) {
      return {
        promise: Promise.resolve({ total: 0, ok: 0, partial: 0, fail: 0, aborted: false, results: [] }),
        abort: () => {},
      };
    }

    const bulkController = new AbortController();
    let done = 0;
    let ok = 0;
    let partial = 0;
    let fail = 0;
    const results = [];

    if (mounted.current) {
      setBulkApproving(true);
    }

    const concurrencyValue = Number(concurrency);
    const normalizedConcurrency = Number.isFinite(concurrencyValue) && concurrencyValue > 0
      ? Math.max(1, Math.floor(concurrencyValue))
      : 3;
    const workerCount = Math.min(items.length, Math.max(1, normalizedConcurrency));
    const stride = workerCount || 1;

    track('marketing_bulk_approve_start', { total: items.length, concurrency: normalizedConcurrency });

    const worker = async (startIndex) => {
      for (let index = startIndex; index < items.length; index += stride) {
        if (bulkController.signal.aborted) {
          break;
        }

        const { jobId, suggestionId } = items[index] || {};
        const result = await approveOne({ jobId, suggestionId, signal: bulkController.signal });
        results[index] = { index, jobId, suggestionId, result };

        if (result.ok) {
          ok += 1;
        } else if (result.partial) {
          partial += 1;
        } else {
          fail += 1;
        }

        done += 1;
        onItem?.(results[index]);
        onProgress?.({ done, total: items.length, ok, partial, fail });
      }
    };

    const promise = (async () => {
      try {
        await Promise.all(Array.from({ length: workerCount }, (_, workerIndex) => worker(workerIndex)));
        const aborted = bulkController.signal.aborted;
        track('marketing_bulk_approve_done', { total: items.length, ok, partial, fail, aborted });
        return { total: items.length, ok, partial, fail, aborted, results };
      } finally {
        if (mounted.current) {
          setBulkApproving(false);
        }
      }
    })();

    const cancel = () => {
      if (!bulkController.signal.aborted) {
        bulkController.abort();
        track('marketing_bulk_approve_cancel', { total: items.length, done, ok, partial, fail });
      }
    };

    return { promise, abort: cancel };
  }, [approveOne]);

  return { approving, bulkApproving, state, approve, retryApprove, abort, approveMany };
}
