import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import inboxApi from '../../api/inboxApi.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import useToastFallback from '../../hooks/useToastFallback.js';
import PagePicker from '../../components/marketing/PagePicker.jsx';
import { mapApiErrorToForm } from '../../ui/errors/mapApiError.js';

export default function FacebookPublisher() {
  const { selected } = useOrg();
  const toast = useToastFallback();
  const [pageId, setPageId] = useState('');
  const [type, setType] = useState('text');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [urls, setUrls] = useState([]); // uploaded urls
  const [uploadProgress, setUploadProgress] = useState({});
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [progressText, setProgressText] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (selected) refreshJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => () => { pollRef.current?.abort?.(); }, []);

  async function refreshJobs() {
    if (!selected) return;
    const { data } = await inboxApi.get(`/orgs/${selected}/facebook/jobs`, { params: { limit: 50 } });
    setJobs(data || []);
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    setError('');
    if (type === 'image' && files.length !== 1) { setError('Selecione 1 imagem'); return; }
    if (type === 'multi' && (files.length < 2 || files.length > 10)) { setError('Selecione de 2 a 10 imagens'); return; }
    if (type === 'video' && files.length !== 1) { setError('Selecione 1 vídeo'); return; }
    const urlsRes = [];
    const prog = {};
    for (const file of files) {
      const mime = file.type;
      if (type === 'video' && mime !== 'video/mp4') { setError('Vídeo MP4 obrigatório'); return; }
      if ((type === 'image' || type === 'multi') && !['image/jpeg','image/png'].includes(mime)) {
        setError('Imagem JPEG/PNG obrigatória'); return; }
      const { data } = await inboxApi.post('/uploads/sign', { contentType: mime, size: file.size });
      await axios.put(data.url, file, {
        headers: { 'Content-Type': mime },
        onUploadProgress: ev => {
          if (!ev.total) return;
          prog[file.name] = Math.round((ev.loaded/ev.total)*100);
          setUploadProgress({ ...prog });
        }
      });
      urlsRes.push(data.objectUrl);
    }
    setUrls(urlsRes);
  }

  function buildBody() {
    const body = { type };
    if (message) body.message = message;
    if (type === 'link') body.link = linkUrl;
    if (type === 'image') body.media = { url: urls[0] };
    if (type === 'multi') body.media = urls.map(u => ({ url: u }));
    if (type === 'video') body.media = { url: urls[0] };
    if (schedule && scheduleAt) body.scheduleAt = new Date(scheduleAt).toISOString();
    return body;
  }

  async function handleSubmit(now) {
    if (!pageId) return;
    setSubmitting(true);
    setProgressText('');
    try {
      const body = buildBody();
      const { data } = await inboxApi.post(`/orgs/${selected}/facebook/pages/${pageId}/publish`, body);
      if (type === 'video' && now) {
        await pollVideo(data.job_id);
      } else {
        toast({ title: now ? 'Publicado' : 'Agendado' });
        refreshJobs();
      }
    } catch (err) {
      mapApiErrorToForm(err, () => {});
    } finally {
      setSubmitting(false);
    }
  }

  async function pollVideo(jobId) {
    const controller = new AbortController();
    pollRef.current = controller;
    const steps = {
      uploading: 'Enviando',
      queued: 'Enfileirado',
      processing: 'Processando vídeo',
      publishing: 'Publicando',
      done: 'Concluído',
      failed: 'Erro'
    };
    async function poll() {
      if (controller.signal.aborted) return;
      const { data } = await inboxApi.get(`/orgs/${selected}/facebook/jobs/${jobId}`);
      const txt = steps[data.status] || data.status;
      setProgressText(txt);
      if (data.status === 'done') {
        toast({ title: 'Publicado' });
        refreshJobs();
      } else if (data.status === 'failed') {
        toast({ title: 'Erro ao publicar', status:'error' });
      } else {
        setTimeout(poll, 1000);
      }
    }
    poll();
  }

  async function cancelJob(id) {
    await inboxApi.patch(`/orgs/${selected}/facebook/jobs/${id}`, { status: 'canceled' });
    toast({ title: 'Job cancelado' });
    refreshJobs();
  }

  async function rescheduleJob(id) {
    const dt = window.prompt('Nova data (YYYY-MM-DDTHH:mm)');
    if (!dt) return;
    await inboxApi.patch(`/orgs/${selected}/facebook/jobs/${id}`, { scheduled_at: new Date(dt).toISOString() });
    toast({ title: 'Job reagendado' });
    refreshJobs();
  }

  const canCompose = !!pageId;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Facebook Publisher</h1>
      <PagePicker onChange={setPageId} />
      {!canCompose ? (
        <div className="text-sm">Selecione ou conecte uma página para publicar.</div>
      ) : (
        <div className="space-y-2">
          <select value={type} onChange={e=>{setType(e.target.value);setUrls([]);}} className="border p-2 rounded">
            <option value="text">Texto</option>
            <option value="link">Link</option>
            <option value="image">Imagem</option>
            <option value="multi">Multi-imagem</option>
            <option value="video">Vídeo</option>
          </select>
          {(type === 'text' || type === 'link') && (
            <textarea aria-label="Mensagem" value={message} onChange={e=>setMessage(e.target.value)} maxLength={5000} className="border p-2 rounded w-full" />
          )}
          {type === 'link' && (
            <input aria-label="URL" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} className="border p-2 rounded w-full" />
          )}
          {(type === 'image' || type === 'multi' || type === 'video') && (
            <input data-testid="file-input" type="file" multiple={type==='multi'} onChange={handleFileChange} className="border p-2 rounded w-full" />
          )}
          {Object.keys(uploadProgress).length > 0 && (
            <div data-testid="progress">{Math.max(...Object.values(uploadProgress))}%</div>
          )}
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
                    {j.published_post_id && (
                      <a href={`https://facebook.com/${j.published_post_id}`} target="_blank" rel="noreferrer">Ver no Facebook</a>
                    )}
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
