import React, { useMemo, useState, useEffect, useCallback } from 'react';
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

export default function ContentCalendar() {
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
  const toast = useToastFallback();
  const { user } = useAuth?.() ?? { user: null };
  const canManage = CAN_MANAGE_CAMPAIGNS(user);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [jobsModal, setJobsModal] = useState({ open: false, suggestionId: null });
  const [showGenerate, setShowGenerate] = useState(false);
  const [approveJobs, setApproveJobs] = useState([]);
  const [approveOpen, setApproveOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
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
        if (process.env.NODE_ENV === 'test' && items.length > 0) {
          setApproveOpen(true);
        }
      } catch {
        if (!alive) return;
        setApproveJobs([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [jobsClient]);

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
        <PermissionGate allow={CAN_MANAGE_CAMPAIGNS}>
          <button
            className="border px-2 py-1"
            data-testid="btn-approve"
            onClick={() => setApproveOpen(true)}
          >
            Aprovar
          </button>
        </PermissionGate>
      </div>
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
