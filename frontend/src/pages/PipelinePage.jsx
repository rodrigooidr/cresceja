import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useApi } from '../contexts/useApi';

const STATUSES = ['prospeccao', 'contato', 'proposta', 'negociacao', 'ganho', 'perdido'];

export default function PipelinePage() {
  const api = useApi();
  const [columns, setColumns] = useState(() => {
    const c = {};
    STATUSES.forEach(s => { c[s] = []; });
    return c;
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cliente: '', leadId: '', valor: '', responsavel: '' });

  const fetchData = async () => {
    try {
      const res = await api.get('/opportunities');
      const grouped = {};
      STATUSES.forEach(s => { grouped[s] = []; });
      res.data.forEach(o => {
        if (!grouped[o.status]) grouped[o.status] = [];
        grouped[o.status].push(o);
      });
      setColumns(grouped);
    } catch (err) {
      console.error('Erro ao buscar oportunidades', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const sourceItems = Array.from(columns[source.droppableId]);
    const [moved] = sourceItems.splice(source.index, 1);
    const destItems = Array.from(columns[destination.droppableId]);
    destItems.splice(destination.index, 0, { ...moved, status: destination.droppableId });
    setColumns(prev => ({
      ...prev,
      [source.droppableId]: sourceItems,
      [destination.droppableId]: destItems,
    }));
    try {
      await api.put(`/opportunities/${moved.id}`, { status: destination.droppableId });
    } catch (err) {
      console.error('Erro ao mover oportunidade', err);
      fetchData();
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        cliente: form.cliente,
        lead_id: form.leadId ? Number(form.leadId) : null,
        valor_estimado: form.valor ? Number(form.valor) : 0,
        responsavel: form.responsavel,
      };
      const res = await api.post('/opportunities', payload);
      const opp = res.data;
      setColumns(prev => ({ ...prev, [opp.status]: [...prev[opp.status], opp] }));
      setForm({ cliente: '', leadId: '', valor: '', responsavel: '' });
      setShowForm(false);
    } catch (err) {
      console.error('Erro ao criar oportunidade', err);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Pipeline de Oportunidades</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-blue-600 text-white rounded">
          + Nova Oportunidade
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 flex flex-wrap gap-2">
          <input
            className="border p-1 flex-1"
            placeholder="Cliente"
            value={form.cliente}
            onChange={e => setForm({ ...form, cliente: e.target.value })}
            required
          />
          <input
            className="border p-1 w-24"
            placeholder="Lead ID"
            value={form.leadId}
            onChange={e => setForm({ ...form, leadId: e.target.value })}
          />
          <input
            className="border p-1 w-32"
            type="number"
            placeholder="Valor"
            value={form.valor}
            onChange={e => setForm({ ...form, valor: e.target.value })}
          />
          <input
            className="border p-1 w-40"
            placeholder="Responsável"
            value={form.responsavel}
            onChange={e => setForm({ ...form, responsavel: e.target.value })}
          />
          <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">Salvar</button>
        </form>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-6 gap-4">
          {STATUSES.map(status => (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-gray-100 p-2 rounded min-h-[200px]"
                >
                  <h3 className="text-sm font-semibold mb-2 capitalize">{status}</h3>
                  {columns[status].map((opp, index) => (
                    <Draggable draggableId={String(opp.id)} index={index} key={opp.id}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          className="bg-white p-2 mb-2 rounded shadow"
                        >
                          <div className="font-medium">{opp.cliente}</div>
                          <div className="text-sm">R$ {Number(opp.valor_estimado).toFixed(2)}</div>
                          {opp.responsavel && (
                            <div className="text-xs text-gray-600">{opp.responsavel}</div>
                          )}
                          <div className="text-xs text-gray-500">
                            {new Date(opp.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
