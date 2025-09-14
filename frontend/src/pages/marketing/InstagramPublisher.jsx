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

  useEffect(() => {
    if (!selected) return;
    inboxApi.get(`/orgs/${selected}/instagram/accounts`).then(r => {
      setAccounts(r.data || []);
      if (r.data?.length) setAccountId(r.data[0].id);
    });
  }, [selected]);

  async function handleSubmit(now) {
    setError('');
    if (!mediaUrl && type !== 'carousel') { setError('Mídia obrigatória'); return; }
    if (type === 'carousel') {
      const parts = mediaUrl.split(',').map(s=>s.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 10) { setError('Máx 10 itens'); return; }
    }
    if (caption.length > 2200) { setError('Legenda muito longa'); return; }
    try {
      const body = { type, caption, media: type==='carousel'?mediaUrl.split(',').map(u=>({url:u.trim()})):{ url: mediaUrl } };
      if (!now && schedule && scheduleAt) body.scheduleAt = new Date(scheduleAt).toISOString();
      await inboxApi.post(`/orgs/${selected}/instagram/accounts/${accountId}/publish`, body);
      toast({ title: now ? 'Publicado' : 'Agendado' });
    } catch (e) {
      const code = e?.response?.data?.error;
      if (code === 'feature_limit_reached') setError('Limite do plano atingido');
      else if (code === 'reauth_required') setError('Reautorização necessária');
      else setError('Erro ao publicar');
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
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={()=>handleSubmit(true)}>Publicar agora</button>
            <button className="btn btn-outline" onClick={()=>handleSubmit(false)}>Agendar</button>
          </div>
        </div>
      )}
    </div>
  );
}
