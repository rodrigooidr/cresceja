import { useCallback, useEffect, useRef, useState } from 'react';
import inboxApi from '../../../api/inboxApi.js';
import { retry } from '../../../lib/retry.js';
import { newIdempotencyKey } from '../../../lib/idempotency.js';
import { track } from '../../../lib/analytics.js';

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
  const [approving, setApproving] = useState(false);
  const [state, setState] = useState({ job: 'idle', suggestion: 'idle', error: null });
  const lastAttempt = useRef(null);
  const inflight = useRef(null);
  const mounted = useRef(true);
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  useEffect(() => () => {
    mounted.current = false;
    inflight.current?.abort?.();
  }, []);

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
        return { ok: true, partial: false, jobStatus, suggestionStatus };
      }

      if (errorType === 'partial') {
        track('marketing_approve_partial', trackPayload);
        return { ok: false, partial: true, jobStatus, suggestionStatus, status };
      }

      track('marketing_approve_error', { ...trackPayload, status });
      return { ok: false, partial: false, reason: 'error', status, jobStatus, suggestionStatus };
    } catch (err) {
      if (err?.name === 'AbortError') {
        track('marketing_approve_abort', trackPayload);
        return { ok: false, partial: false, reason: 'abort', jobStatus: 'idle', suggestionStatus: 'idle' };
      }

      if (mounted.current) {
        setState((prev) => ({ ...prev, error: 'full' }));
      }

      const status = err?.status ?? err?.response?.status;
      track('marketing_approve_error', { ...trackPayload, status });
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

  return { approving, state, approve, retryApprove, abort };
}
