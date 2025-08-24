import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useApi } from '../../contexts/useApi';

function ContentCalendar() {
  const api = useApi();
  const [calendarId, setCalendarId] = useState(null);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const resCal = await axios.get('/calendar');
        const cal = resCal.data?.data?.[0];
        if (cal) {
          setCalendarId(cal.id);
          const res = await axios.get(`/calendar/${cal.id}/events`);
          let evts = res.data.data || [];
          try {
            const campRes = await axios.get('/marketing/campaigns');
            const camps = (campRes.data.data || []).map((c) => ({
              id: c.id,
              title: c.name,
              channels: ['email'],
              scheduled_at: c.scheduled_at,
              status: c.status,
              preview_url: null,
            }));
            evts = evts.concat(camps);
          } catch (err) {
            console.error('Erro ao carregar campanhas', err);
          }
          setEvents(evts);
        }
      } catch (err) {
        console.error('Erro ao carregar calendário', err);
      }
    })();
  }, []);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setEvents(items);
    const base = new Date();
    const newDate = new Date(base.getTime() + result.destination.index * 3600000);
    try {
      await axios.patch(`/calendar/${calendarId}/events/${moved.id}`, {
        scheduledAt: newDate.toISOString(),
      });
    } catch (err) {
      console.error('Erro ao reagendar', err);
    }
  };

  const filtered = filter ? events.filter((e) => e.status === filter) : events;

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Content Calendar</h1>
      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos</option>
          <option value="scheduled">Agendado</option>
          <option value="published">Publicado</option>
          <option value="failed">Falhou</option>
        </select>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="events">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {filtered.map((ev, index) => (
                <Draggable key={ev.id} draggableId={ev.id} index={index}>
                  {(prov) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      {...prov.dragHandleProps}
                      className="p-3 bg-white rounded shadow flex gap-3 items-center"
                    >
                      {ev.preview_url ? (
                        <img src={ev.preview_url} alt="preview" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded" />
                      )}
                      <div>
                        <div className="font-bold">{ev.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(ev.scheduled_at).toLocaleString()}
                        </div>
                        <div className="text-xs">{(ev.channels || []).join(', ')}</div>
                        <div className="text-xs capitalize">{ev.status}</div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

export default ContentCalendar;


