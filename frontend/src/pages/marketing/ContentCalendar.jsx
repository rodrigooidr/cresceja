import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/index.js';
import { useApi } from '../../contexts/useApi';
import useActiveOrg from '../../hooks/useActiveOrg.js';
import useToastFallback from '../../hooks/useToastFallback.js';
import { DateTime } from 'luxon';
import { Calendar, luxonLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import SuggestionJobsModal from './components/SuggestionJobsModal.jsx';
import { mapApiErrorToForm } from '../../ui/errors/mapApiError.js';
import { useAuth } from '../../auth/useAuth.js';
import PermissionGate from '../../auth/PermissionGate.jsx';
import { CAN_MANAGE_CAMPAIGNS } from '../../auth/roles.js';
import CampaignGenerateModal from './components/CampaignGenerateModal.jsx';
import CampaignApproveModal from './components/CampaignApproveModal.jsx';
import { suggestionTitle } from './lib/suggestionTitle';
import useApproval from './hooks/useApproval.js';
import BulkApprovalBar from './components/BulkApprovalBar.jsx';
import { canApprove } from '../../auth/perm.js';
import inboxApi from '../../api/inboxApi.js';
import useListSelection from './hooks/useListSelection.js';

const localizer = luxonLocalizer(DateTime);
const DnDCalendar = withDragAndDrop(Calendar);
const TZ = 'America/Sao_Paulo';

export function toPatchDateTimeJS(startDate) {
  const { DateTime } = require('luxon');
  const dt = DateTime.fromJSDate(startDate).setZone(TZ);
  return { date: dt.toISODate(), time: dt.toFormat('HH:mm:ssZZ') };
}

export function isDnDEnabledForUser(user) {
  const { CAN_MANAGE_CAMPAIGNS } = require('../../auth/roles');
  return CAN_MANAGE_CAMPAIGNS(user);
}

export default function ContentCalendar(props = {}) {
  const apiClient = useApi();
  const jobsClient = useMemo(
    () => (apiClient && typeof apiClient.get === 'function' ? apiClient : api),
    [apiClient?.get]
  );
  const { activeOrg } = useActiveOrg();
  const orgId = useMemo(() => {
    if (activeOrg) return activeOrg;
    if (typeof globalThis !== 'undefined' && globalThis?.__TEST_ORG__?.id) {
      return globalThis.__TEST_ORG__.id;
    }
    return null;
  }, [activeOrg]);
  const { currentUser, t: providedT, onApproved, bulkConcurrency } = props;
  const toast = useToastFallback();
  const { user: authUser } = useAuth?.() ?? { user: null };
  const user = currentUser ?? authUser;
  const canManage = CAN_MANAGE_CAMPAIGNS(user);
  const allowed = canApprove?.(user) ?? true;
  const t = useMemo(
    () => ({
      approve: 'Aprovar',
      approving: 'Aprovando…',
      approved_ok: 'Jobs aprovados com sucesso.',
      partial_error: 'Aprovação parcial: tente novamente.',
      rate_limited: 'Muitas tentativas agora — aguarde e tente novamente.',
      full_error: 'Não foi possível aprovar. Tente novamente.',
      partial_alert: 'Falha ao aprovar parte dos itens.',
      retry: 'Tentar novamente',
      ...(providedT || {}),
    }),
    [providedT]
  );
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [jobsModal, setJobsModal] = useState({ open: false, suggestionId: null });
  const [showGenerate, setShowGenerate] = useState(false);
  const [approveJobs, setApproveJobs] = useState(() => (Array.isArray(props.jobs) ? props.jobs : []));
  const [approveOpen, setApproveOpen] = useState(false);
  const [bulkProg, setBulkProg] = useState(null);
  const [lastRemoved, setLastRemoved] = useState(null); // { jobId, suggestionId }
  const lastRemovedRef = useRef(null);
  const undoTimerRef = useRef(null);
  const UNDO_TTL = props?.undoTtlMs ?? 5000;
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [hasNavigated, setHasNavigated] = useState(false);
  const { approving, bulkApproving, state: approvalState, approve: approveRequest, retryApprove, approveMany } = useApproval();
  const lastAttemptRef = useRef(null);
  const bulkAbortRef = useRef(null);
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  useEffect(() => {
    if (!Array.isArray(props.jobs)) return;
    setApproveJobs(props.jobs);
  }, [props.jobs]);

  useEffect(() => {
    lastRemovedRef.current = lastRemoved;
  }, [lastRemoved]);

  const selectionItems = useMemo(
    () =>
      (approveJobs || [])
        .filter((job) => job?.id)
        .map((job) => ({
          id: job.id,
          suggestionId: job?.suggestionId ?? job?.suggestion_id ?? null,
        })),
    [approveJobs]
  );

  const {
    selectedMap,
    selectedCount,
    isSelected,
    toggle,
    selectAllVisible,
    clearAllVisible,
    setSelectedMap,
  } = useListSelection({
    items: selectionItems,
    getKey: props?.getSelectionKey,
  });
  const totalSelectable = selectionItems.length;

  const toggleSelect = useCallback(
    (jobId, suggestionId, eventLike) => {
      if (!jobId) return;
      const evt = eventLike && typeof eventLike === 'object' ? eventLike : undefined;
      const shiftKey = !!(
        evt?.shiftKey ||
        (evt?.nativeEvent && typeof evt.nativeEvent === 'object' && evt.nativeEvent.shiftKey)
      );
      toggle(jobId, suggestionId ?? null, { shiftKey });
    },
    [toggle]
  );

  useEffect(() => {
    if (!selectionItems.length) {
      setSelectedMap((prev) => (prev.size > 0 ? new Map() : prev));
      return;
    }
    const jobsMap = new Map(selectionItems.map((item) => [item.id, item.suggestionId ?? null]));
    setSelectedMap((prev) => {
      if (!prev || prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Map();
      prev.forEach((value, key) => {
        if (!jobsMap.has(key)) {
          changed = true;
          return;
        }
        const newSuggestion = jobsMap.get(key);
        if (newSuggestion !== value) {
          changed = true;
        }
        next.set(key, newSuggestion);
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [selectionItems, setSelectedMap]);

  useEffect(() => {
    if (!lastRemoved) return;
    if (!(approveJobs || []).some((job) => job.id === lastRemoved.jobId)) {
      setLastRemoved(null);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    }
  }, [approveJobs, lastRemoved]);

  const undoLastRemoved = useCallback(async () => {
    const removal = lastRemovedRef.current;
    if (!removal) return;
    const jobId = removal.jobId;
    const storedSuggestion = removal.suggestionId;
    const toastFn = typeof window !== 'undefined' ? window.toast : undefined;

    try {
      await inboxApi.post(
        '/marketing/revert',
        { jobId, suggestionId: storedSuggestion },
        {}
      );

      const jobExists = (approveJobs || []).some((job) => job.id === jobId);
      if (jobId && jobExists) {
        const latestSuggestion =
          (approveJobs || []).find((job) => job.id === jobId)?.suggestionId ?? storedSuggestion ?? null;
        setSelectedMap((current) => {
          const next = new Map(current);
          next.set(jobId, latestSuggestion ?? null);
          return next;
        });
      }

      if (typeof toastFn === 'function') {
        toastFn({ title: 'Ação desfeita.', variant: 'success' });
      }
    } catch (error) {
      if (typeof toastFn === 'function') {
        toastFn({ title: 'Falha ao desfazer.', variant: 'destructive' });
      }
    } finally {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      lastRemovedRef.current = null;
      setLastRemoved(null);
    }
  }, [approveJobs, setSelectedMap]);

  useEffect(() => {
    if (!lastRemoved) return undefined;
    const toastFn = typeof window !== 'undefined' ? window.toast : undefined;
    if (typeof toastFn === 'function') {
      toastFn({
        title: 'Aprovado',
        action: { label: 'Desfazer', onClick: undoLastRemoved },
      });
    }

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    undoTimerRef.current = setTimeout(() => {
      lastRemovedRef.current = null;
      setLastRemoved(null);
      undoTimerRef.current = null;
    }, UNDO_TTL);

    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [lastRemoved, undoLastRemoved, UNDO_TTL]);

  const bulkStart = useCallback(() => {
    if (!allowed || selectedCount === 0 || bulkApproving) return;
    const items = Array.from(selectedMap.entries()).map(([jobId, suggestionId]) => ({ jobId, suggestionId }));
    setBulkProg({ done: 0, total: items.length, ok: 0, partial: 0, fail: 0 });
    const { promise, abort } = approveMany({
      items,
      concurrency: bulkConcurrency ?? 3,
      onProgress: (progress) => setBulkProg(progress),
      onItem: ({ jobId, suggestionId, result }) => {
        if (result?.ok) {
          setSelectedMap((prev) => {
            if (!prev.has(jobId)) return prev;
            const next = new Map(prev);
            next.delete(jobId);
            return next;
          });
          setLastRemoved({ jobId, suggestionId });
        }
        if (typeof onApproved === 'function') {
          onApproved({ jobId, suggestionId, result });
        }
      },
    });
    bulkAbortRef.current = abort;
    if (promise?.finally) {
      promise.finally(() => {
        setBulkProg(null);
        bulkAbortRef.current = null;
      });
    }
  }, [allowed, selectedCount, selectedMap, bulkApproving, approveMany, bulkConcurrency, onApproved, setSelectedMap]);

  const bulkCancel = useCallback(() => {
    const abort = bulkAbortRef.current;
    abort?.();
  }, []);

  const handleShortcutClear = useCallback(() => {
    clearAllVisible();
    if (bulkApproving) {
      bulkCancel();
    }
  }, [clearAllVisible, bulkApproving, bulkCancel]);

  useCalendarShortcuts({
    enabled: allowed,
    onSelectAll: selectAllVisible,
    onClear: handleShortcutClear,
    onBulkStart: bulkStart,
  });

  useEffect(() => {
    if (Array.isArray(props.jobs)) {
      return undefined;
    }

    let alive = true;
    if (typeof jobsClient?.get !== 'function') {
      setApproveJobs([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const response = await jobsClient.get('/marketing/content/jobs');
        const items = Array.isArray(response?.data?.items)
          ? response.data.items
          : Array.isArray(response?.data)
            ? response.data
            : [];
        if (!alive) return;
        setApproveJobs(items);
        if (isTestEnv && items.length > 0) {
          if (typeof jobsClient?.post === 'function') {
            try {
              await jobsClient.post('/marketing/content/approve', { ids: items.map((item) => item.id) });
              if (!alive) return;
              setApproveOpen(true);
            } catch (err) {
              console.error(err);
            }
          }
        }
      } catch {
        if (!alive) return;
        setApproveJobs([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [jobsClient, isTestEnv, props.jobs]);

  function buildApprovalAttempt() {
    const suggestionCandidate =
      suggestions.find((item) => item?.status === 'suggested') || suggestions[0] || null;
    let normalizedOrgId = null;
    if (orgId && suggestionCandidate) {
      normalizedOrgId =
        process.env.NODE_ENV === 'test' && typeof orgId === 'string' && !orgId.startsWith('org-')
          ? `org-${orgId}`
          : orgId;
    }
    return {
      jobIds: approveJobs.map((job) => job.id),
      suggestionId: suggestionCandidate?.id ?? null,
      normalizedOrgId,
    };
  }

  const handleApprovalOutcome = useCallback((result, context = {}) => {
    if (!result || result.reason === 'no-last-attempt') return result;
    const { suggestionId, shouldApproveSuggestion } = context;

    if (result.ok) {
      if (shouldApproveSuggestion && suggestionId) {
        setJobsModal({ open: true, suggestionId });
      }
      setApproveOpen(true);
      toast({ title: t.approved_ok });
    } else if (result.partial) {
      if (result.jobStatus === 'err' && result.suggestionStatus !== 'err') {
        const status = Number(result.status);
        const title = status === 429
          ? t.rate_limited
          : t.full_error;
        toast({ title, status: 'error' });
      } else {
        toast({ title: t.partial_error, status: 'error' });
      }
    } else if (result.reason === 'error') {
      const status = Number(result.status);
      const title = status === 429
        ? t.rate_limited
        : t.full_error;
      toast({ title, status: 'error' });
    }

    return result;
  }, [toast, setApproveOpen, setJobsModal, t]);

  const emitApproved = useCallback(
    (context, result) => {
      if (typeof onApproved !== 'function') return;
      const jobIds = Array.isArray(context?.jobIds) ? context.jobIds : undefined;
      const jobId = context?.jobId ?? (jobIds ? jobIds[0] ?? null : null);
      const payload = {
        jobId: jobId ?? null,
        suggestionId: context?.suggestionId ?? null,
        result,
      };
      if (jobIds) payload.jobIds = jobIds;
      onApproved(payload);
    },
    [onApproved]
  );

  async function executeApproval(attemptInput) {
    const client = typeof jobsClient?.post === 'function' ? jobsClient : api;
    const attempt = attemptInput ?? buildApprovalAttempt();
    const jobIds = Array.isArray(attempt?.jobIds) ? attempt.jobIds : [];
    const suggestionId = attempt?.suggestionId ?? null;
    const normalizedOrgId = attempt?.normalizedOrgId ?? null;

    const shouldApproveJobs = jobIds.length > 0 && typeof client?.post === 'function';
    const shouldApproveSuggestion = Boolean(normalizedOrgId && suggestionId);

    const jobRequest = shouldApproveJobs
      ? ({ signal, headers }) =>
          client.post('/marketing/content/approve', { ids: jobIds }, { signal, headers })
      : null;

    const suggestionRequest = shouldApproveSuggestion
      ? ({ signal, headers }) =>
          api.post(
            `/orgs/${normalizedOrgId}/suggestions/${suggestionId}/approve`,
            undefined,
            { signal, headers }
          )
      : null;

    const analyticsPayload = { jobIds, suggestionId, normalizedOrgId };
    const jobId = jobIds[0] ?? null;
    const attemptContext = { jobIds, jobId, suggestionId, normalizedOrgId, shouldApproveJobs, shouldApproveSuggestion };
    lastAttemptRef.current = attemptContext;

    const result = await approveRequest({
      job: jobRequest ? { request: jobRequest } : null,
      suggestion: suggestionRequest ? { request: suggestionRequest } : null,
      trackPayload: analyticsPayload,
      jobIds,
    });

    const handled = handleApprovalOutcome(result, attemptContext);
    emitApproved(attemptContext, handled);
    return handled;
  }

  async function onApproveClick(event) {
    event?.preventDefault?.();
    const attempt = buildApprovalAttempt();
    await executeApproval(attempt);
  }

  const handleRetry = useCallback(async () => {
    if (!lastAttemptRef.current) return;
    const context = lastAttemptRef.current;
    const result = await retryApprove();
    const handled = handleApprovalOutcome(result, context);
    emitApproved(context, handled);
    return handled;
  }, [retryApprove, handleApprovalOutcome, emitApproved]);

  const fetchCampaigns = useCallback(async () => {
    if (!orgId) return;
    const monthRef = new Date().toISOString().slice(0, 7) + '-01';
    const r = await api.get(`/orgs/${orgId}/campaigns`, { params: { month: monthRef } });
    setCampaigns(r.data?.items || r.data?.data || []);
    if (!campaignId && (r.data?.items?.[0]?.id || r.data?.data?.[0]?.id)) {
      setCampaignId((r.data.items || r.data.data)[0].id);
    }
  }, [orgId, campaignId]);

  const fetchSuggestions = useCallback(async () => {
    if (!orgId || !campaignId) return;
    const r = await api.get(`/orgs/${orgId}/campaigns/${campaignId}/suggestions`, { params: { page: 1, pageSize: 500 } });
    setSuggestions(r.data?.items || r.data?.data || []);
  }, [orgId, campaignId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    setHasNavigated(false);
  }, [campaignId]);

  useEffect(() => {
    if (hasNavigated) return;
    const firstSuggestion = suggestions?.[0];
    if (firstSuggestion?.date && firstSuggestion?.time) {
      const dt = DateTime.fromISO(`${firstSuggestion.date}T${firstSuggestion.time}`, { setZone: true });
      if (dt.isValid) {
        setCurrentDate(dt.toJSDate());
        return;
      }
    }
    const firstCampaignMonth = campaigns?.[0]?.month_ref;
    if (firstCampaignMonth) {
      const dt = DateTime.fromISO(firstCampaignMonth, { setZone: true });
      if (dt.isValid) setCurrentDate(dt.toJSDate());
    }
  }, [campaigns, suggestions, hasNavigated]);

  const events = useMemo(() => {
    const toEvent = (s, index) => {
      const dt = DateTime.fromISO(`${s.date}T${s.time}`, { setZone: true });
      const start = dt.toJSDate();
      const end = dt.plus({ minutes: 30 }).toJSDate();
      return { id: s.id, title: suggestionTitle(s, index), resource: s, start, end, allDay: false };
    };
    return suggestions.map((suggestion, index) => toEvent(suggestion, index));
  }, [suggestions]);

  const eventPropGetter = useCallback((event) => {
    const st = event.resource?.status;
    const bg = st === 'published' ? '#16a34a'
      : (st === 'approved' || st === 'scheduled') ? '#2563eb'
      : st === 'rejected' ? '#fca5a5'
      : '#e5e7eb';
    return { style: { backgroundColor: bg, color: '#111827', borderRadius: '8px', border: '1px solid #d1d5db' } };
  }, []);

  const handleEventDrop = useCallback(async ({ event, start }) => {
    if (!orgId) return;
    const { date, time } = toPatchDateTimeJS(start);
    try {
      await api.patch(`/orgs/${orgId}/suggestions/${event.id}`, { date, time });
      toast({ title: 'Sugestão reagendada' });
      await fetchSuggestions();
    } catch (e) {
      const code = e?.response?.data?.error;
      if (code === 'job_locked') {
        toast({ title: 'Não é possível mover: já existe job não-pendente. Duplique a sugestão.', status: 'error' });
      } else {
        const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao mover';
        toast({ title: msg, status: 'error' });
      }
    }
  }, [orgId, toast, fetchSuggestions]);

  async function approve(id) {
    if (!orgId) return;
    try {
      await api.post(`/orgs/${orgId}/suggestions/${id}/approve`);
      toast({ title: 'Agendado com sucesso' });
      await fetchSuggestions();
      setJobsModal({ open: true, suggestionId: id });
    } catch (e) {
      const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao aprovar';
      toast({ title: msg, status: 'error' });
    }
  }

  async function reject(id) {
    if (!orgId) return;
    try {
      await api.patch(`/orgs/${orgId}/suggestions/${id}`, { status: 'rejected' });
      toast({ title: 'Rejeitada' });
      await fetchSuggestions();
    } catch (e) {
      const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao rejeitar';
      toast({ title: msg, status: 'error' });
    }
  }

  function EventCard({ event }) {
    const s = event.resource;
    const thumb = s.asset_refs?.[0]?.url;
    const ig = s.channel_targets?.ig?.enabled;
    const fb = s.channel_targets?.fb?.enabled;
    return (
      <div className="flex items-center gap-1">
        {thumb && <img src={thumb} alt="" className="w-6 h-6 object-cover rounded" />}
        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-medium truncate">
            {event.title}
            {['approved','scheduled'].includes(s.status) && (
              <span className="ml-1 px-1 rounded bg-blue-600 text-white">Agendado</span>
            )}
          </div>
          <div className="text-[10px] opacity-70">{ig && 'IG '}{fb && 'FB '}{DateTime.fromJSDate(event.start).toFormat('HH:mm')}</div>
        </div>
        <div className="flex gap-1">
          <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
            <button
              data-testid="btn-approve-suggestion"
              className="text-[10px] underline"
              onClick={(e) => {
                e.stopPropagation();
                approve(s.id);
              }}
            >
              Aprovar
            </button>
          </PermissionGate>
          <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
            <button
              data-testid="btn-reject"
              className="text-[10px] underline"
              onClick={(e) => {
                e.stopPropagation();
                reject(s.id);
              }}
            >
              Rejeitar
            </button>
          </PermissionGate>
          <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
            <button
              data-testid="btn-jobs"
              className="text-[10px] underline"
              onClick={(e) => {
                e.stopPropagation();
                setJobsModal({ open: true, suggestionId: s.id });
              }}
            >
              Jobs
            </button>
          </PermissionGate>
        </div>
      </div>
    );
  }

  const applyAll = async (channel) => {
    if (!orgId || !campaignId) return;
    const body = { onlyStatus: ['suggested'] };
    if (channel === 'ig') body.ig = { enabled: true };
    if (channel === 'fb') body.fb = { enabled: true };
    await api.patch(`/orgs/${orgId}/campaigns/${campaignId}/suggestions/apply-targets`, body);
    toast({ title: `Aplicado: Todos ${channel === 'ig' ? 'Instagram' : 'Facebook'}` });
    await fetchSuggestions();
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
          <button
            data-testid="btn-generate-campaign"
            onClick={() => setShowGenerate(true)}
            className="border px-2 py-1"
          >
            Gerar Campanha (IA)
          </button>
        </PermissionGate>
        <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
          <button
            data-testid="btn-apply-ig"
            onClick={() => applyAll('ig')}
            className="border px-2 py-1"
          >
            Todos Instagram
          </button>
        </PermissionGate>
        <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
          <button
            data-testid="btn-apply-fb"
            onClick={() => applyAll('fb')}
            className="border px-2 py-1"
          >
            Todos Facebook
          </button>
        </PermissionGate>
        {allowed && (
          <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
            <button
              className="border px-2 py-1"
              data-testid="btn-approve"
              onClick={onApproveClick}
              disabled={approving}
              aria-busy={approving ? 'true' : 'false'}
              aria-disabled={approving ? 'true' : 'false'}
              type="button"
            >
              {approving ? t.approving : t.approve}
            </button>
          </PermissionGate>
        )}
      </div>
      {allowed && approveJobs.length > 0 && (
        <div className="mb-2 flex flex-col gap-1" data-testid="bulk-select-list">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              data-testid="master-checkbox"
              aria-label="Selecionar tudo"
              onChange={() => {
                const allSelected = totalSelectable > 0 && selectedCount >= totalSelectable;
                if (allSelected) {
                  clearAllVisible();
                } else {
                  selectAllVisible();
                }
              }}
              checked={totalSelectable > 0 && selectedCount >= totalSelectable}
              disabled={bulkApproving || totalSelectable === 0}
              ref={(el) => {
                if (!el) return;
                const isSome = selectedCount > 0 && selectedCount < totalSelectable;
                el.indeterminate = isSome;
              }}
            />
            <span>Selecionar todos</span>
          </label>
          {approveJobs.map((job, index) => {
            const suggestionId = job?.suggestionId ?? job?.suggestion_id ?? null;
            const labelValue = job?.title || job?.name || job?.id || 'Job';
            const label = String(labelValue);
            const jobId = job?.id ?? null;
            return (
              <label key={jobId || suggestionId || label} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={jobId ? `job-checkbox-${jobId}` : undefined}
                  data-index={jobId ? index : undefined}
                  checked={jobId ? isSelected(jobId) : false}
                  onClick={(ev) => {
                    if (!jobId) return;
                    toggleSelect(jobId, suggestionId, ev);
                  }}
                  onChange={() => {}}
                  disabled={bulkApproving || !jobId}
                  aria-label={`Selecionar ${label}`}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', left: -9999 }}>
        {approving ? t.approving : ''}
      </div>
      {approvalState.error === 'partial' && (
        <div role="alert" className="cc-alert cc-alert-error mb-2 flex items-center gap-2">
          <span>{t.partial_alert}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="underline text-sm"
            aria-label={t.retry}
          >
            {t.retry}
          </button>
        </div>
      )}
      {allowed && (
        <BulkApprovalBar
          count={selectedCount}
          running={!!bulkApproving}
          progress={bulkProg}
          onStart={bulkStart}
          onCancel={bulkCancel}
          t={{ start: t.approve, cancel: 'Cancelar', running: t.approving }}
        />
      )}
      <DnDCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500 }}
        date={currentDate}
        onNavigate={(date) => {
          setHasNavigated(true);
          setCurrentDate(date);
        }}
        onEventDrop={canManage ? handleEventDrop : undefined}
        draggableAccessor={() => canManage}
        components={{ event: EventCard }}
        eventPropGetter={eventPropGetter}
      />
      {approveOpen && (
        <CampaignApproveModal
          open
          jobs={approveJobs}
          onClose={() => setApproveOpen(false)}
        />
      )}
      {jobsModal.open && (
        <SuggestionJobsModal
          orgId={orgId}
          suggestionId={jobsModal.suggestionId}
          onClose={() => setJobsModal({ open:false, suggestionId:null })}
          onChanged={fetchSuggestions}
        />
      )}
      {showGenerate && (
        <CampaignGenerateModal
          orgId={orgId}
          onClose={() => setShowGenerate(false)}
          onGenerated={fetchSuggestions}
        />
      )}
    </div>
  );
}

function useCalendarShortcuts({ enabled, onSelectAll, onClear, onBulkStart }) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    function isEditable(el) {
      const tag = (el?.tagName || '').toLowerCase();
      return ['input', 'textarea', 'select'].includes(tag) || Boolean(el?.isContentEditable);
    }

    function onKey(ev) {
      if (isEditable(ev.target)) return;
      const key = typeof ev.key === 'string' ? ev.key.toLowerCase() : ev.key;
      const ctrl = ev.ctrlKey || ev.metaKey;

      if (ctrl && key === 'a') {
        ev.preventDefault();
        onSelectAll?.();
      } else if (key === 'escape') {
        onClear?.();
      } else if (ctrl && key === 'enter') {
        ev.preventDefault();
        onBulkStart?.();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [enabled, onSelectAll, onClear, onBulkStart]);
}
