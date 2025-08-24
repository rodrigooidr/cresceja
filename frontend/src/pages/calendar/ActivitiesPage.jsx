import axios from 'axios';
import { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

export default function ActivitiesPage() {
  const api = useApi();
  const [calendars, setCalendars] = useState([]);
  const [newCal, setNewCal] = useState('');
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ title: '', client: '', start: '', end: '' });

  useEffect(() => {
    loadCalendars();
  }, []);

  async function loadCalendars() {
    try {
      const res = await axios.get('/activities/calendars');
      setCalendars(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao carregar calendários', err);
    }
  }

  async function createCalendar(e) {
    e.preventDefault();
    try {
      const res = await axios.post('/activities/calendars', { name: newCal });
      setCalendars([res.data, ...calendars]);
      setNewCal('');
    } catch (err) {
      console.error('Erro ao criar calendário', err);
    }
  }

  async function removeCalendar(id) {
    try {
      await axios.delete(`/activities/calendars/${id}`);
      setCalendars(calendars.filter((c) => c.id !== id));
      if (selected === id) {
        setSelected(null);
        setEvents([]);
      }
    } catch (err) {
      console.error('Erro ao remover calendário', err);
    }
  }

  async function selectCalendar(id) {
    setSelected(id);
    try {
      const res = await axios.get(`/activities/calendars/${id}/events`);
      setEvents(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
    }
  }

  async function createEvent(e) {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await axios.post(`/activities/calendars/${selected}/events`, {
        title: eventForm.title,
        clientName: eventForm.client,
        startAt: eventForm.start,
        endAt: eventForm.end,
      });
      setEvents([...events, res.data]);
      setEventForm({ title: '', client: '', start: '', end: '' });
    } catch (err) {
      if (err.response?.status === 409) {
        alert('Conflito de horário');
      } else {
        console.error('Erro ao criar evento', err);
      }
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Calendários de Atividades</h1>
      <form onSubmit={createCalendar} className="mb-4 flex gap-2">
        <input
          value={newCal}
          onChange={(e) => setNewCal(e.target.value)}
          className="border p-2 rounded flex-1"
          placeholder="Novo calendário"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Criar
        </button>
      </form>
      <div className="flex gap-4">
        <div className="w-1/3">
          <ul className="space-y-2">
            {calendars.map((c) => (
              <li
                key={c.id}
                onClick={() => selectCalendar(c.id)}
                className={`p-2 border rounded cursor-pointer ${selected === c.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <span>{c.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCalendar(c.id);
                    }}
                    className="text-red-500 text-sm"
                  >
                    remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1">
          {selected && (
            <div>
              <h2 className="text-xl mb-2">Eventos</h2>
              <ul className="space-y-2 mb-4">
                {events.map((ev) => (
                  <li key={ev.id} className="border p-2 rounded">
                    <div className="font-bold">{ev.title}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(ev.start_at).toLocaleString()} - {new Date(ev.end_at).toLocaleString()}
                    </div>
                    {ev.client_name && <div className="text-sm">{ev.client_name}</div>}
                  </li>
                ))}
              </ul>
              <form onSubmit={createEvent} className="space-y-2">
                <input
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="border p-2 rounded w-full"
                  placeholder="Assunto"
                />
                <input
                  value={eventForm.client}
                  onChange={(e) => setEventForm({ ...eventForm, client: e.target.value })}
                  className="border p-2 rounded w-full"
                  placeholder="Cliente"
                />
                <input
                  type="datetime-local"
                  value={eventForm.start}
                  onChange={(e) => setEventForm({ ...eventForm, start: e.target.value })}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="datetime-local"
                  value={eventForm.end}
                  onChange={(e) => setEventForm({ ...eventForm, end: e.target.value })}
                  className="border p-2 rounded w-full"
                />
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
                  Reservar
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


