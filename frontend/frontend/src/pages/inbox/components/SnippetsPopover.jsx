// src/pages/inbox/components/SnippetsPopover.jsx
import React, { useRef } from 'react';


export default function SnippetsPopover({ open, onClose, items, onPick, onCreate, onEdit, onDelete, onImport, onExport, anchorRef }) {
if (!open) return null;
return (
<div className="absolute bottom-16 left-3 z-40 bg-white border rounded-xl shadow-lg w-[420px] p-2">
<div className="flex items-center gap-2 mb-2">
<button className="btn btn-xs" onClick={onCreate}>Novo</button>
<button className="btn btn-xs" onClick={onExport}>Exportar</button>
<label className="btn btn-xs">
Importar
<input type="file" accept="application/json" className="hidden" onChange={(e)=>e.target.files?.[0] && onImport(e.target.files[0])} />
</label>
<button className="btn btn-ghost btn-xs ml-auto" onClick={onClose}>Fechar</button>
</div>
<div className="max-h-[40vh] overflow-auto divide-y">
{items.map((it) => (
<div key={it.id} className="py-2 flex items-start gap-2">
<div className="flex-1">
<div className="font-medium">{it.title}</div>
<div className="text-xs text-gray-600 whitespace-pre-wrap">{it.content}</div>
</div>
<div className="flex flex-col gap-1">
<button className="btn btn-ghost btn-xxs" onClick={()=>onPick?.(it)}>Inserir</button>
<button className="btn btn-ghost btn-xxs" onClick={()=>onEdit?.(it)}>Editar</button>
<button className="btn btn-ghost btn-xxs text-red-500" onClick={()=>onDelete?.(it.id)}>Excluir</button>
</div>
</div>
))}
{!items.length && <div className="p-3 text-sm text-gray-500">Sem snippets.</div>}
</div>
</div>
);
}