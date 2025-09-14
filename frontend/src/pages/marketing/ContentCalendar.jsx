import React, { useMemo, useState, useEffect, useCallback } from 'react';
import api from '../../api/index.js';
import useActiveOrg from '../../hooks/useActiveOrg.js';
import useToastFallback from '../../hooks/useToastFallback.js';
import { DateTime } from 'luxon';
import { Calendar, luxonLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import SuggestionJobsModal from './components/SuggestionJobsModal.jsx';
import { mapApiErrorToForm } from '../../ui/errors/mapApiError.js';
import { useAuth } from '../../auth/useAuth.js';
import CampaignGenerateModal from './components/CampaignGenerateModal.jsx';

const localizer = luxonLocalizer(DateTime);
const DnDCalendar = withDragAndDrop(Calendar);
const TZ = 'America/Sao_Paulo';

export function toPatchDateTimeJS(startDate) {
  const { DateTime } = require('luxon');
  const dt = DateTime.fromJSDate(startDate).setZone(TZ);
  return { date: dt.toISODate(), time: dt.toFormat('HH:mm:ssZZ') };
}

export default function ContentCalendar() {
  const { activeOrg } = useActiveOrg();
  const toast = useToastFallback();
  const { user } = useAuth();
  const canManage = !!user?.permissions?.includes('CAN_MANAGE_CAMPAIGNS');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [jobsModal, setJobsModal] = useState({ open: false, suggestionId: null });
  const [showGenerate, setShowGenerate] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (!activeOrg) return;
    const monthRef = new Date().toISOString().slice(0, 7) + '-01';
    const r = await api.get(`/orgs/${activeOrg}/campaigns`, { params: { month: monthRef } });
    setCampaigns(r.data?.items || r.data?.data || []);
    if (!campaignId && (r.data?.items?.[0]?.id || r.data?.data?.[0]?.id)) {
      setCampaignId((r.data.items || r.data.data)[0].id);
    }
  }, [activeOrg, campaignId]);

  const fetchSuggestions = useCallback(async () => {
    if (!activeOrg || !campaignId) return;
    const r = await api.get(`/orgs/${activeOrg}/campaigns/${campaignId}/suggestions`, { params: { page: 1, pageSize: 500 } });
    setSuggestions(r.data?.items || r.data?.data || []);
  }, [activeOrg, campaignId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const events = useMemo(() => {
    const toEvent = (s) => {
      const dt = DateTime.fromISO(`${s.date}T${s.time}`, { setZone: true });
      const start = dt.toJSDate();
      const end = dt.plus({ minutes: 30 }).toJSDate();
      return { id: s.id, title: s.copy_json?.headline || 'Sugestão', resource: s, start, end, allDay: false };
    };
    return suggestions.map(toEvent);
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
    if (!activeOrg) return;
    const { date, time } = toPatchDateTimeJS(start);
    try {
      await api.patch(`/orgs/${activeOrg}/suggestions/${event.id}`, { date, time });
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
  }, [activeOrg, toast, fetchSuggestions]);

  async function approve(id) {
    if (!activeOrg) return;
    try {
      await api.post(`/orgs/${activeOrg}/suggestions/${id}/approve`);
      toast({ title: 'Agendado com sucesso' });
      await fetchSuggestions();
      setJobsModal({ open: true, suggestionId: id });
    } catch (e) {
      const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao aprovar';
      toast({ title: msg, status: 'error' });
    }
  }

  async function reject(id) {
    if (!activeOrg) return;
    try {
      await api.patch(`/orgs/${activeOrg}/suggestions/${id}`, { status: 'rejected' });
      toast({ title: 'Rejeitada' });
      await fetchSuggestions();
    } catch (e) {
      const msg = mapApiErrorToForm(e, () => {}).toast || 'Falha ao rejeitar';
      toast({ title: msg, status: 'error' });
    }
  }

  const draggableAccessor = (event) => !['published', 'rejected'].includes(event.resource?.status);

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
        {canManage ? (
          <div className="flex gap-1">
            <button data-testid="btn-approve" className="text-[10px] underline" onClick={(e) => { e.stopPropagation(); approve(s.id); }}>Aprovar</button>
            <button data-testid="btn-reject" className="text-[10px] underline" onClick={(e) => { e.stopPropagation(); reject(s.id); }}>Rejeitar</button>
            <button data-testid="btn-jobs" className="text-[10px] underline" onClick={(e) => { e.stopPropagation(); setJobsModal({ open: true, suggestionId: s.id }); }}>Jobs</button>
          </div>
        ) : (
          <span className="text-[10px" title="Você não tem permissão para gerenciar campanhas.">-</span>
        )}
      </div>
    );
  }

  const applyAll = async (channel) => {
    if (!activeOrg || !campaignId) return;
    const body = { onlyStatus: ['suggested'] };
    if (channel === 'ig') body.ig = { enabled: true };
    if (channel === 'fb') body.fb = { enabled: true };
    await api.patch(`/orgs/${activeOrg}/campaigns/${campaignId}/suggestions/apply-targets`, body);
    toast({ title: `Aplicado: Todos ${channel === 'ig' ? 'Instagram' : 'Facebook'}` });
    await fetchSuggestions();
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        {canManage ? (
          <button data-testid="btn-generate-campaign" onClick={()=>setShowGenerate(true)} className="border px-2 py-1">Gerar Campanha (IA)</button>
        ) : (
          <span className="text-xs" title="Você não tem permissão para gerenciar campanhas.">Gerar Campanha (IA)</span>
        )}
        {canManage && (
          <>
            <button data-testid="btn-apply-ig" onClick={() => applyAll('ig')} className="border px-2 py-1">Todos Instagram</button>
            <button data-testid="btn-apply-fb" onClick={() => applyAll('fb')} className="border px-2 py-1">Todos Facebook</button>
          </>
        )}
      </div>
      <DnDCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500 }}
        onEventDrop={canManage ? handleEventDrop : undefined}
        draggableAccessor={draggableAccessor}
        components={{ event: EventCard }}
        eventPropGetter={eventPropGetter}
      />
      {jobsModal.open && (
        <SuggestionJobsModal
          orgId={activeOrg}
          suggestionId={jobsModal.suggestionId}
          onClose={() => setJobsModal({ open:false, suggestionId:null })}
          onChanged={fetchSuggestions}
        />
      )}
      {showGenerate && (
        <CampaignGenerateModal
          orgId={activeOrg}
          onClose={() => setShowGenerate(false)}
          onGenerated={fetchSuggestions}
        />
      )}
    </div>
  );
}
