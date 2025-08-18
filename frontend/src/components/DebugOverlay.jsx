import React, { useEffect, useState } from "react";

function fmt(ts){ const d = new Date(ts); return d.toLocaleTimeString(); }

export default function DebugOverlay(){
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [net, setNet] = useState([]);

  useEffect(()=>{
    const t = setInterval(()=>{
      const s = window.__debugStore;
      if (s){ setLogs([...s.logs]); setNet([...s.net]); }
    }, 500);
    return ()=> clearInterval(t);
  },[]);

  return (
    <>
      <button
        onClick={()=> setOpen(v=>!v)}
        style={{ position:"fixed", right:12, bottom:12, zIndex:99999 }}
        className="px-3 py-2 rounded-xl shadow bg-black text-white text-sm opacity-80 hover:opacity-100"
        title="Abrir debug (captura console, erros e rede)"
      >
        🐞 Debug
      </button>
      {!open ? null : (
        <div
          style={{ position:"fixed", right:12, bottom:60, width:"min(95vw, 900px)", height:"60vh", zIndex:99998 }}
          className="rounded-xl shadow-2xl bg-white border overflow-hidden"
        >
          <div className="px-3 py-2 border-b bg-gray-50 text-sm font-semibold flex items-center justify-between">
            <span>Diagnóstico em tempo real</span>
            <button onClick={()=> setOpen(false)} className="text-xs px-2 py-1 rounded border">Fechar</button>
          </div>
          <div className="grid grid-cols-2 h-[calc(60vh-40px)]">
            <div className="border-r overflow-auto text-xs">
              <div className="px-2 py-1 sticky top-0 bg-white border-b font-semibold">Console & Erros</div>
              {logs.length ? logs.slice().reverse().map((l,i)=>(
                <div key={i} className={`px-2 py-1 border-b ${l.level==='error'?'bg-red-50':l.level==='warn'?'bg-yellow-50':''}`}>
                  <div className="text-gray-500">{fmt(l.ts)} — {l.level.toUpperCase()}</div>
                  <pre className="whitespace-pre-wrap break-words">{(l.args||[]).map(a=> typeof a==='string'?a:JSON.stringify(a)).join(" ")}</pre>
                </div>
              )) : <div className="p-2 text-gray-500">Sem logs capturados ainda.</div>}
            </div>
            <div className="overflow-auto text-xs">
              <div className="px-2 py-1 sticky top-0 bg-white border-b font-semibold">Rede (fetch/XHR)</div>
              {net.length ? net.slice().reverse().map((n,i)=>(
                <div key={i} className="px-2 py-1 border-b">
                  <div className="text-gray-500">{fmt(n.ts)} — {n.type.toUpperCase()} {n.method} {n.status} ({n.ms}ms)</div>
                  <div className="truncate">{n.url}</div>
                </div>
              )) : <div className="p-2 text-gray-500">Sem requisições ainda.</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
