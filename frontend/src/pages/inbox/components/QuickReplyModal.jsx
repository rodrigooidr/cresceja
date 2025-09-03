import React from 'react';
export default function QuickReplyModal({ open, onClose, quickReplies, onSelect }) {
if(!open) return null;
return (
<div className="absolute bottom-14 left-4 bg-white border rounded shadow p-2 w-80 max-h-80 overflow-auto">
{quickReplies.map(q=>(
<div key={q.id} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={()=>onSelect(q)}>{q.title}</div>
))}
<button className="btn btn-xs mt-2" onClick={onClose}>Fechar</button>
</div>
);
}