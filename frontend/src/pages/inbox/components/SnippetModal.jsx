import React from 'react';
export default function SnippetModal({ open, onClose, snippets, onInsert }) {
if(!open) return null;
return (
<div className="absolute bottom-14 left-20 bg-white border rounded shadow p-2 w-80 max-h-80 overflow-auto">
{snippets.map(s=>(
<div key={s.id} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={()=>onInsert(s.content)}>{s.title}</div>
))}
<button className="btn btn-xs mt-2" onClick={onClose}>Fechar</button>
</div>
);
}