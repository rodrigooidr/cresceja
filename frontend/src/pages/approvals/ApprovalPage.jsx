import React, { useState, useCallback } from 'react';
import inboxApi from '../../api/inboxApi';
import { useApi } from '../../contexts/useApi';
import useOrgRefetch from '../../hooks/useOrgRefetch';

function ApprovalPage() {
  const api = useApi();
  const [posts, setPosts] = useState([]);

  const carregarPendentes = useCallback(async () => {
    try {
      const res = await inboxApi.get('/posts', { params: { status: 'pendente' } });
      setPosts(res.data?.items ?? res.data ?? []);
    } catch (err) {
      console.error('Erro ao buscar posts pendentes', err);
    }
  }, []);

  const atualizarStatus = async (id, status) => {
    try {
      await inboxApi.put(`/posts/${id}/status`, { status });
      carregarPendentes();
    } catch (err) {
      console.error('Erro ao atualizar status', err);
    }
  };

  useOrgRefetch(carregarPendentes, [carregarPendentes]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Aprovação de Conteúdo</h1>
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

