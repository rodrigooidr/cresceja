import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

function ApprovalPage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [posts, setPosts] = useState([]);

  const carregarPendentes = async () => {
    try {
      const res = await api.get('/posts?status=pendente');
      setPosts(res.data);
    } catch (err) {
      console.error('Erro ao buscar posts pendentes', err);
    }
  };

  const atualizarStatus = async (id, status) => {
    try {
      await api.put(`/posts/${id}/status`, { status });
      carregarPendentes();
    } catch (err) {
      console.error('Erro ao atualizar status', err);
    }
  };

  useEffect(() => {
    carregarPendentes();
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold mb-4">Aprovação de Conteúdo</h1>
        <button type="button" onClick={carregarPendentes} className="text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60" disabled={loading}>Atualizar</button>
      </div>
      {erro && (<div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{erro}</div>)}
      {posts.length === 0 ? (
        <p className="text-gray-500">Nenhum post pendente.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map(post => (
            <li key={post.id} className="bg-white p-4 rounded shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm mb-1"><strong>{post.channel}</strong> — {post.text}</p>
                  {post.imageUrl && <img src={post.imageUrl} alt="preview" className="max-w-xs mt-2 rounded" />}
                  <p className="text-xs text-gray-500 mt-1">
                    Agendado para: {new Date(post.scheduledFor).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => atualizarStatus(post.id, 'Aprovado')}
                    className="bg-green-600 text-white text-sm px-3 py-1 rounded"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => atualizarStatus(post.id, 'Rejeitado')}
                    className="bg-red-500 text-white text-sm px-3 py-1 rounded"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ApprovalPage;