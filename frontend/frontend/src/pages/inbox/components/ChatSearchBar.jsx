import React from 'react';
export default function ChatSearchBar({ value, setValue, next, prev, count }) {
return (
<div className="p-2 border-b flex gap-2 items-center bg-gray-50">
<input className="input input-sm flex-1" placeholder="Buscar no chat…" value={value} onChange={(e)=>setValue(e.target.value)} />
<span className="text-xs text-gray-500">{count}</span>
<button className="btn btn-xs" onClick={prev}>↑</button>
<button className="btn btn-xs" onClick={next}>↓</button>
</div>
);
}