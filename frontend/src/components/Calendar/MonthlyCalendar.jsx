import React, { useMemo } from "react";

function daysInMonth(y, m){ return new Date(y, m+1, 0).getDate(); }
function firstWeekday(y, m){ return new Date(y, m, 1).getDay(); } // 0=Dom

export default function MonthlyCalendar({ year, month, events=[] }){
  const grid = useMemo(()=>{
    const total = daysInMonth(year, month);
    const start = firstWeekday(year, month); // domingo-index
    const cells = [];
    for(let i=0;i<start;i++) cells.push(null);
    for(let d=1; d<=total; d++) cells.push(d);
    while(cells.length % 7) cells.push(null);
    return cells;
  }, [year, month]);

  const evByDay = useMemo(()=>{
    const map = {};
    (events || []).forEach(e=>{
      const d = new Date(e.date);
      if (d.getFullYear()===year && d.getMonth()===month) {
        const day = d.getDate();
        (map[day] = map[day] || []).push(e);
      }
    });
    return map;
  }, [year, month, events]);

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="w-full border rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-7 text-center text-xs font-semibold bg-gray-50 border-b">
        {weekdays.map(w => <div key={w} className="p-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i)=>{
          const dayEvents = d ? (evByDay[d] || []) : [];
          return (
            <div key={i} className={`min-h-[80px] p-2 border -mt-px -ml-px ${d ? 'bg-white' : 'bg-gray-50 text-transparent'}`}>
              <div className="text-xs font-semibold text-gray-700">{d || '.'}</div>
              <div className="mt-1 space-y-1">
                {dayEvents.length ? dayEvents.map((e, idx)=>(
                  <div key={idx} className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 truncate">{e.title}</div>
                )) : (
                  <div className="text-[10px] text-gray-400">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
