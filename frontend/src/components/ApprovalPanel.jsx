import React, { useState, useEffect } from 'react';
import { authFetch } from '../services/session.js';

function ApprovalPanel({ postId }) {
  const [history, setHistory] = useState([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');

  const fetchHistory = async () => {
    const res = await authFetch(`/api/approvals/${postId}/approval-history`);
    const data = await res.json();
    setHistory(data);
    setStatus(data?.[0]?.status || 'draft');
  };

  useEffect(() => {
    fetchHistory();
  }, [postId]);

  const requestApproval = async () => {
    await authFetch(`/api/approvals/${postId}/request-approval`, {
      method: 'POST',
    });
    fetchHistory();
  };

  const approve = async () => {
    await authFetch(`/api/approvals/${postId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment })
    });
    fetchHistory();
  };

  const reject = async () => {
    await authFetch(`/api/approvals/${postId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment })
    });
    fetchHistory();
  };

  return (
    <div className="bg-white border p-4 rounded space-y-3">
      <h3 className="text-lg font-bold">Fluxo de Aprovação</h3>
      <p>Status atual: <strong>{status}</strong></p>

      <textarea
        className="border p-2 w-full"
        rows="2"
        placeholder="Comentário..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="space-x-2">
        <button className="bg-yellow-500 text-white px-3 py-1 rounded" onClick={requestApproval}>
          Solicitar Aprovação
        </button>
        <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={approve}>
          Aprovar
        </button>
        <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={reject}>
          Rejeitar
        </button>
      </div>

      <div>
        <h4 className="font-semibold mt-4">Histórico:</h4>
        {history.map((h, i) => (
          <div key={i} className="text-sm border-t pt-2 mt-2">
            <p><strong>{h.status.toUpperCase()}</strong> – {h.comment || 'sem comentário'}</p>
            <p><i>{new Date(h.updated_at).toLocaleString()}</i></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApprovalPanel;