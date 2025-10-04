import React from 'react';
export default function QuickReplyModal({ open, onClose, quickReplies, onSelect }) {
  if (!open) return null;
  return (
    <div className="absolute bottom-14 left-4 bg-white border rounded shadow p-2 w-80 max-h-80 overflow-auto" data-testid="quick-reply-palette">
      {quickReplies.map((q) => (
        <div
          key={q.id}
          data-testid={`qr-item-${q.id}`}
          className="p-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => onSelect(q)}
        >
          <span style={{ display: 'none' }} data-testid={`quick-item-${q.id}`} />
          {q.title}
        </div>
      ))}
      <button className="btn btn-xs mt-2" onClick={onClose}>Fechar</button>
    </div>
  );
}