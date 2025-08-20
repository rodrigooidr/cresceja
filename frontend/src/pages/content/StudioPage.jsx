import React, { useState, useEffect } from 'react';
import { api } from '../../api/axios';

export default function StudioPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assets, setAssets] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const res = await api.get('/content/assets');
    setAssets(res.data.data || []);
  };

  const upload = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await api.post('/content/assets', {
        filename: file.name,
        data: reader.result,
      });
      setFile(null);
      loadAssets();
    };
    reader.readAsDataURL(file);
  };

  const savePost = async () => {
    await api.post('/content/posts', {
      title,
      content,
      channels: [],
      preview_asset: preview,
    });
    setTitle('');
    setContent('');
    setPreview(null);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Estúdio de Conteúdo</h2>
      <input
        className="border p-2 w-full"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="border p-2 w-full"
        rows={4}
        placeholder="Conteúdo"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="space-y-2">
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button
          onClick={upload}
          disabled={!file}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          Upload
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {assets.map((a) => (
          <img
            key={a.id}
            src={a.url}
            alt={a.filename}
            onClick={() => setPreview(a.id)}
            className={`border cursor-pointer ${
              preview === a.id ? 'ring-2 ring-blue-500' : ''
            }`}
          />
        ))}
      </div>
      <button
        onClick={savePost}
        disabled={!title}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Salvar Post
      </button>
    </div>
  );
}
