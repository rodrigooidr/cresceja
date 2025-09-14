import React, { useEffect, useRef, useState } from 'react';
import { useApi } from '../../contexts/useApi.js';
import useActiveOrg from '../../hooks/useActiveOrg.js';
import useToastFallback from '../../hooks/useToastFallback.js';
import { useParams } from 'react-router-dom';
import FeatureGate from '../../ui/feature/FeatureGate.jsx';

function ContentEditor() {
  const { suggestionId } = useParams();
  const api = useApi();
  const { activeOrg } = useActiveOrg();
  const toast = useToastFallback();

  const canvasRef = useRef(null);
  const abortRef = useRef(null);
  const [image, setImage] = useState(null);
  const [logo, setLogo] = useState(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [assetRefs, setAssetRefs] = useState([]);

  const presets = [
    { name: '1:1', w: 1080, h: 1080 },
    { name: '4:5', w: 1080, h: 1350 },
    { name: '9:16', w: 1080, h: 1920 },
    { name: '1200×630', w: 1200, h: 630 }
  ];
  const [preset, setPreset] = useState(presets[0]);

  useEffect(() => {
    if (!activeOrg || !suggestionId) return;
    let ignore = false;
    api.get(`/orgs/${activeOrg}/suggestions/${suggestionId}`).then(r => {
      if (!ignore) setAssetRefs(r.data?.asset_refs || []);
    });
    return () => { ignore = true; };
  }, [api, activeOrg, suggestionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = preset.w;
    canvas.height = preset.h;
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
    if (logo) {
      ctx.drawImage(logo.img, logo.x, logo.y, logo.img.width * logo.scale, logo.img.height * logo.scale);
    }
    if (text) {
      ctx.fillStyle = '#000';
      ctx.font = '32px sans-serif';
      ctx.fillText(text, 20, canvas.height - 40);
    }
  }, [image, text, logo, preset]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setLogo({ img, x: 0, y: 0, scale: 1 });
    img.src = URL.createObjectURL(file);
  }

function applyPreset(p) {
  setPreset(p);
}

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function save(isVariant=false) {
    if (!activeOrg || !canvasRef.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSaving(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      const { data:sign } = await api.post('/uploads/sign', { contentType: 'image/jpeg', size: blob.size }, { signal: controller.signal });
      await fetch(sign.url, { method:'PUT', headers:{ 'Content-Type':'image/jpeg' }, body: blob, signal: controller.signal });
      const { data:asset } = await api.post(`/orgs/${activeOrg}/assets`, { url: sign.objectUrl, mime:'image/jpeg', width: canvas.width, height: canvas.height }, { signal: controller.signal });
      const newRef = { asset_id: asset.asset_id, type: 'image' };
      const refs = isVariant ? [...assetRefs, newRef] : [newRef];
      await api.patch(`/orgs/${activeOrg}/suggestions/${suggestionId}`, { asset_refs: refs }, { signal: controller.signal });
      if (isVariant) setAssetRefs(refs);
      toast({ title: isVariant ? 'Variação salva' : 'Salvo' });
    } catch (e) {
      if (e.name !== 'AbortError') {
        toast({ title:'Erro ao salvar', status:'error' });
      }
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

  function SafeAreaOverlay({ target }) {
    if (target === 'ig') {
      return (
        <div data-testid="safe-area" className="pointer-events-none absolute inset-0">
          <div style={{position:'absolute',top:0,height:120,width:'100%',background:'rgba(0,0,0,0.08)'}}></div>
          <div style={{position:'absolute',bottom:0,height:120,width:'100%',background:'rgba(0,0,0,0.08)'}}></div>
        </div>
      );
    }
    if (target === 'fb') {
      return (
        <div data-testid="safe-area" className="pointer-events-none absolute inset-0 border-4 border-black opacity-10" />
      );
    }
    return null;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Editor de Conteúdo</h1>
      <div className="flex gap-2">
        {presets.map(p => (
          <button key={p.name} onClick={()=>applyPreset(p)} className="border px-2 py-1" data-testid="preset-btn">{p.name}</button>
        ))}
      </div>
      <div className="relative inline-block">
        <canvas data-testid="canvas" ref={canvasRef} width={preset.w} height={preset.h} className="border w-full max-w-lg" />
        <SafeAreaOverlay target="ig" />
      </div>
      <div>
        <input data-testid="file-input" type="file" accept="image/*" onChange={handleFile} />
      </div>
      <div>
        <input type="file" onChange={handleLogo} data-testid="logo-input" />
      </div>
      <div>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Texto" className="border p-2" />
      </div>
      <div className="flex gap-2">
        <button onClick={()=>save(false)} disabled={saving} className="btn btn-primary">Salvar</button>
        <button onClick={()=>save(true)} disabled={saving} className="btn">Salvar variação</button>
        <FeatureGate code="ai_image_generator">
          <button onClick={generateIA} disabled={iaLoading} className="btn btn-outline">Gerar com IA</button>
        </FeatureGate>
      </div>
    </div>
  );
}

export default ContentEditor;
