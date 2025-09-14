import { useEffect, useState } from 'react';
import axios from 'axios';
import inboxApi from '../../api/inboxApi.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import useToastFallback from '../../hooks/useToastFallback.js';

export default function InstagramPublisher() {
  const { selected } = useOrg();
  const toast = useToastFallback();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progressText, setProgressText] = useState('');

  useEffect(() => {
    if (!selected) return;
    inboxApi.get(`/orgs/${selected}/instagram/accounts`).then(r => {
      setAccounts(r.data || []);
      if (r.data?.length) setAccountId(r.data[0].id);
    });
    refreshJobs();
  }, [selected]);

  async function refreshJobs() {
    if (!selected) return;
    const r = await inboxApi.get(`/orgs/${selected}/instagram/jobs`);
    setJobs(r.data || []);
  }

  async function handleSubmit(now) {
    setError('');
    setProgressText('');
    setSubmitting(true);
    if (!mediaUrl && type !== 'carousel') { setError('Mídia obrigatória'); return; }
    if (type === 'carousel') {
      const parts = mediaUrl.split(',').map(s=>s.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 10) { setError('Máx 10 itens'); return; }
    }
    if (caption.length > 2200) { setError('Legenda muito longa'); return; }
    try {
      const body = { type, caption, media: type==='carousel'?mediaUrl.split(',').map(u=>({url:u.trim()})):{ url: mediaUrl } };
      if (!now && schedule && scheduleAt) body.scheduleAt = new Date(scheduleAt).toISOString();
      const { data } = await inboxApi.post(`/orgs/${selected}/instagram/accounts/${accountId}/publish`, body);
      if (type === 'video' && now) {
        const jobId = data.job_id;
        setProgressText('Criando container');
        const poll = async () => {
          const jr = await inboxApi.get(`/orgs/${selected}/instagram/jobs/${jobId}`);
          const j = jr.data;
          if (j.status === 'creating' && !j.creation_id) setProgressText('Criando container');
          else if (j.status === 'creating' && j.creation_id) setProgressText('Processando vídeo...');
          else if (j.status === 'publishing') setProgressText('Publicando...');
          else if (j.status === 'done') {
            setProgressText('Concluído');
            toast({ title: 'Publicado' });
            setSubmitting(false);
            refreshJobs();
            return;
          } else if (j.status === 'failed') {
            setProgressText('Erro');
            toast({ title: 'Erro ao publicar', status:'error' });
            setSubmitting(false);
            return;
          }
          setTimeout(poll, 1000);
        };
        poll();
      } else {
        toast({ title: now ? 'Publicado' : 'Agendado' });
        setSubmitting(false);
        refreshJobs();
      }
    } catch (e) {
      const code = e?.response?.data?.error;
      if (code === 'feature_limit_reached') setError('Limite do plano atingido');
      else if (code === 'reauth_required') setError('Reautorização necessária');
      else setError('Erro ao publicar');
      setSubmitting(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const mime = file.type;
    if (type === 'image' && mime !== 'image/jpeg') { setError('Imagem JPEG obrigatória'); return; }
    if (type === 'video' && mime !== 'video/mp4') { setError('Vídeo MP4 obrigatório'); return; }
    const max = type === 'image' ? 10*1024*1024 : 100*1024*1024;
    if (file.size > max) { setError('Arquivo muito grande'); return; }
    const { data } = await inboxApi.post('/uploads/sign', { contentType: mime, size: file.size });
    setUploadProgress(0);
    await axios.put(data.url, file, {
      headers: { 'Content-Type': mime },
      onUploadProgress: ev => {
        if (!ev.total) return;
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    });
    setMediaUrl(data.objectUrl);
  }

  async function cancelJob(id) {
    await inboxApi.patch(`/orgs/${selected}/instagram/jobs/${id}`, { status:'canceled' });
    toast({ title:'Job cancelado' });
    refreshJobs();
  }

  async function rescheduleJob(id) {
    const dt = window.prompt('Nova data (YYYY-MM-DDTHH:mm)');
    if (!dt) return;
    await inboxApi.patch(`/orgs/${selected}/instagram/jobs/${id}`, { scheduled_at: new Date(dt).toISOString() });
    toast({ title:'Job reagendado' });
    refreshJobs();
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Instagram Publisher</h1>
      {accounts.length === 0 ? <div>Nenhuma conta.</div> : (
        <div className="space-y-2">
          <select value={accountId} onChange={e=>setAccountId(e.target.value)} className="border p-2 rounded">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.username||a.ig_user_id}</option>)}
          </select>
          <div>
            <select value={type} onChange={e=>setType(e.target.value)} className="border p-2 rounded">
              <option value="image">Imagem</option>
              <option value="carousel">Carrossel</option>
              <option value="video">Vídeo</option>
            </select>
          </div>
          {type === 'carousel'
            ? <input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="URLs separados por vírgula" className="border p-2 rounded w-full" />
            : <input data-testid="file-input" type="file" onChange={handleFileChange} className="border p-2 rounded w-full" />}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div data-testid="progress">Progresso: {uploadProgress}%</div>
          )}
          <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Legenda" className="border p-2 rounded w-full" />
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={schedule} onChange={e=>setSchedule(e.target.checked)} />
            <span>Agendar</span>
            {schedule && <input type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)} className="border p-2 rounded" />}
          </div>
          {progressText && <div data-testid="progress-text">{progressText}</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button disabled={submitting} className="btn btn-primary" onClick={()=>handleSubmit(true)}>Publicar agora</button>
            <button disabled={submitting} className="btn btn-outline" onClick={()=>handleSubmit(false)}>Agendar</button>
          </div>
        </div>
      )}
      {jobs.length > 0 && (
        <div className="mt-4">
          <table className="w-full text-sm" data-testid="jobs-table">
            <thead><tr><th>Tipo</th><th>Status</th><th>Agendado</th><th>Atualizado</th><th>Ações</th></tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td>{j.type}</td>
                  <td>{j.status}</td>
                  <td>{j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : '-'}</td>
                  <td>{j.updated_at ? new Date(j.updated_at).toLocaleString() : '-'}</td>
                  <td>
                    {j.published_media_id && <a href={`https://instagram.com/p/${j.published_media_id}`} target="_blank" rel="noreferrer">Post</a>}
                    {j.status === 'pending' && (
                      <>
                        <button onClick={()=>cancelJob(j.id)}>Cancelar</button>
                        <button onClick={()=>rescheduleJob(j.id)}>Reagendar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
