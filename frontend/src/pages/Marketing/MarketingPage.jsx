import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

const canais = ['instagram', 'facebook', 'linkedin'];

function MarketingPage() {
  const api = useApi();
  const [posts, setPosts] = useState([]);
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState('instagram');
  const [data, setData] = useState('');
  const [imagem, setImagem] = useState('');

  const carregarPosts = async () => {
    try {
      const res = await api.get('/posts');
      setPosts(res.data);
    } catch (err) {
      console.error('Erro ao carregar posts', err);
    }
  };

  const criarPost = async () => {
    if (!texto || !canal) return;
    try {
      await api.post('/posts', {
        text: texto,
        channel: canal,
        scheduledFor: data,
        imageUrl: imagem || null
      });
      setTexto('');
      setData('');
      setImagem('');
      carregarPosts();
    } catch (err) {
      console.error('Erro ao criar post', err);
    }
  };

  useEffect(() => {
    carregarPosts();
  }, []);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Marketing com IA</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Texto do post"
          className="border p-2 rounded w-64"
        />
        <input
          value={imagem}
          onChange={e => setImagem(e.target.value)}
          placeholder="URL da imagem"
          className="border p-2 rounded w-64"
        />
        <select
          value={canal}
          onChange={e => setCanal(e.target.value)}
          className="border p-2 rounded"
        >
          {canais.map(c => <option key={c}>{c}</option>)}
        </select>
        <input
          type="datetime-local"
          value={data}
          onChange={e => setData(e.target.value)}
          className="border p-2 rounded"
        />
        <button onClick={criarPost} className="bg-blue-600 text-white px-4 py-2 rounded">
          + Criar Post
        </button>
      </div>

      <ul className="space-y-2">
        {posts.map((post, idx) => (
          <li key={idx} className="bg-white p-3 rounded shadow text-sm">
            <div className="flex justify-between">
              <span>
                <strong>{post.channel}</strong>: {post.text}
              </span>
              <span className="text-gray-500">{new Date(post.scheduledFor).toLocaleString()}</span>
            </div>
            {post.imageUrl && <img src={post.imageUrl} alt="Post visual" className="mt-2 max-w-xs rounded" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MarketingPage;