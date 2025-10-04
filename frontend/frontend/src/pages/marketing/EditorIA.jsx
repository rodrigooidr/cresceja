import React, { useEffect, useMemo, useState } from 'react';

const TONS = [
  { id: 'neutro', label: 'Neutro' },
  { id: 'profissional', label: 'Profissional' },
  { id: 'amigavel', label: 'Amigavel' },
  { id: 'divertido', label: 'Divertido' },
];

const CANAIS = [
  { id: 'instagram', label: 'Instagram (ate 2.200 caracteres)', limit: 2200 },
  { id: 'facebook', label: 'Facebook (sem limite pratico)' },
  { id: 'whatsapp', label: 'WhatsApp (mensagem curta)' },
  { id: 'linkedin', label: 'LinkedIn (profissional)' },
];

function gerarHashtags(texto, max = 5) {
  // Remove acentos sem usar \p{...}
  const base = (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')              // remove diacriticos
    .replace(/[^a-zA-Z0-9\s]/g, ' ');              // mantem apenas letras/numeros/espaco (ASCII)

  const palavras = base.split(/\s+/).filter(w => w && w.length > 2);
  const stop = new Set(['de','da','do','e','a','o','os','as','um','uma','para','pra','com','sem','que','em','no','na','nos','nas']);
  const freq = {};
  for (const w of palavras) {
    if (!stop.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, max).map(([w]) => '#' + w.replace(/[^a-z0-9]/g,''));
  return Array.from(new Set(top));
}

export default function EditorIA() {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tone, setTone] = useState('neutro');
  const [canal, setCanal] = useState('instagram');
  const [usarHashtags, setUsarHashtags] = useState(true);

  const [generated, setGenerated] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('editorIA_draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.caption) setCaption(draft.caption);
        if (draft.tone) setTone(draft.tone);
        if (draft.canal) setCanal(draft.canal);
        if (typeof draft.usarHashtags === 'boolean') setUsarHashtags(draft.usarHashtags);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const payload = { title, caption, tone, canal, usarHashtags };
    localStorage.setItem('editorIA_draft', JSON.stringify(payload));
  }, [title, caption, tone, canal, usarHashtags]);

  const canaisById = useMemo(() => CANAIS.reduce((acc,c)=> (acc[c.id]=c, acc), {}), []);
  const lengthLimit = canaisById[canal]?.limit || Infinity;
  const chars = (generated || '').length;
  const overLimit = chars > lengthLimit;

  const montarTextoLocal = () => {
    const prefixoTom = {
      neutro: '',
      profissional: ' (tom profissional e claro)',
      amigavel: ' (tom amigavel e proximo)',
      divertido: ' (tom leve e criativo)',
    }[tone] || '';

    const prefixoCanal = {
      instagram: 'Formato focado em Instagram, com chamada breve e escaneavel.',
      facebook: 'Formato descritivo, pode ter 2 a 3 frases.',
      whatsapp: 'Mensagem curta e direta, 1-2 frases.',
      linkedin: 'Texto conciso, com credibilidade e chamada para acao.',
    }[canal] || '';

    const tags = usarHashtags ? gerarHashtags((title || '') + ' ' + (caption || '')).join(' ') : '';
    const partes = [
      title ? '📣 ' + title : null,
      (caption || '').trim() || null,
      tags ? '\n' + tags : null,
    ].filter(Boolean);

    const rascunho = partes.join('\n\n');
    const meta = (prefixoCanal + prefixoTom).trim();
    return meta ? rascunho + '\n\n' : rascunho;
  };

  const gerarComIA = async () => {
    setErro('');
    if (!title && !caption) {
      setErro('Inclua pelo menos um titulo ou um texto base.');
      return;
    }
    setLoading(true);
    try {
      setGenerated(montarTextoLocal());
    } catch (e) {
      console.error(e);
      setErro('Falha ao gerar conteudo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(generated); } catch {}
  };

  const limpar = () => { setGenerated(''); setErro(''); };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Editor de Conteudo com IA</h1>
      <p className="text-sm text-gray-600 mb-4">Gere textos para posts e mensagens com diferentes tons e canais.</p>

      <div className="grid gap-3">
        <input
          className="border p-2 rounded w-full"
          placeholder="Titulo do post"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="border p-2 rounded w-full"
          placeholder="Texto base ou instrucao"
          rows={5}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tom</label>
            <select
              className="border p-2 rounded w-full"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              {TONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Canal</label>
            <select
              className="border p-2 rounded w-full"
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
            >
              {CANAIS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 mt-6 sm:mt-7">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={usarHashtags}
              onChange={(e) => setUsarHashtags(e.target.checked)}
            />
            <span className="text-sm">Gerar hashtags</span>
          </label>
        </div>

        {erro && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{erro}</div>}

        <div className="flex gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
            onClick={gerarComIA}
            disabled={loading}
            type="button"
          >
            {loading ? 'Gerando...' : 'Gerar com IA'}
          </button>

          <button
            className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200"
            onClick={limpar}
            type="button"
          >
            Limpar
          </button>
        </div>

        {generated && (
          <div className="mt-4 p-3 border rounded bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Previa do conteudo</h3>
              <div className="text-xs text-gray-600">
                {Number.isFinite(lengthLimit) && (
                  <span className={overLimit ? 'text-red-600 font-medium' : ''}>
                    {chars}/{lengthLimit} {overLimit ? '- ultrapassou o limite!' : ''}
                  </span>
                )}
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm">{generated}</pre>
            <div className="mt-3 flex gap-2">
              <button className="bg-gray-900 text-white px-3 py-2 rounded" onClick={copiar} type="button">
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}