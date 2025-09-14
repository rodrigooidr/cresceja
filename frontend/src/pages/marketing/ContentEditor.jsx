import React, { useEffect, useRef, useState } from 'react';
import { useApi } from '../../contexts/useApi.js';
import useActiveOrg from '../../hooks/useActiveOrg.js';
import useToastFallback from '../../hooks/useToastFallback.js';
import { useParams } from 'react-router-dom';

function ContentEditor() {
  const { suggestionId } = useParams();
  const api = useApi();
  const { activeOrg } = useActiveOrg();
  const toast = useToastFallback();

  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (image) {
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    if (text) {
      ctx.fillStyle = '#000';
      ctx.font = '32px sans-serif';
      ctx.fillText(text, 20, canvas.height - 40);
    }
  }, [image, text]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  }

  async function save() {
    if (!activeOrg || !canvasRef.current) return;
    setSaving(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      const { data:sign } = await api.post('/uploads/sign', { contentType: 'image/jpeg', size: blob.size });
      await fetch(sign.url, { method:'PUT', headers:{ 'Content-Type':'image/jpeg' }, body: blob });
      const { data:asset } = await api.post(`/orgs/${activeOrg}/assets`, { url: sign.objectUrl, mime:'image/jpeg', width: canvas.width, height: canvas.height });
      await api.patch(`/orgs/${activeOrg}/suggestions/${suggestionId}`, { asset_refs:[{ asset_id: asset.asset_id, type:'image' }] });
      toast({ title:'Salvo' });
    } catch (e) {
      toast({ title:'Erro ao salvar', status:'error' });
    } finally {
      setSaving(false);
    }
  }

  async function generateIA() {
    if (!activeOrg) return;
    setIaLoading(true);
    try {
      const { data } = await api.post(`/orgs/${activeOrg}/ai/images/generate`, { prompt: '' });
      const url = data.assets?.[0]?.url;
      if (url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImage(img);
        img.src = url;
      }
    } catch (e) {
      if (e?.response?.data?.error === 'feature_limit_reached') {
        toast({ title:'Limite do plano atingido', status:'error' });
      } else {
        toast({ title:'Erro ao gerar IA', status:'error' });
      }
    } finally {
      setIaLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Editor de Conteúdo</h1>
      <canvas data-testid="canvas" ref={canvasRef} width={1080} height={1080} className="border w-full max-w-lg" />
      <div>
        <input data-testid="file-input" type="file" accept="image/*" onChange={handleFile} />
      </div>
      <div>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Texto" className="border p-2" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn btn-primary">Salvar</button>
        <button onClick={generateIA} disabled={iaLoading} className="btn btn-outline">Gerar com IA</button>
      </div>
    </div>
  );
}

export default ContentEditor;
