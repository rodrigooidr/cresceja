import inboxApi from "../../api/inboxApi";
import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import OpportunityModal from '../components/OpportunityModal';
import { useApi } from '../contexts/useApi';

const STATUSES = ['prospeccao', 'contato', 'proposta', 'negociacao', 'fechamento'];

export default function PipelinePage() {
  const api = useApi();
  const [columns, setColumns] = useState(() => ({
    prospeccao: [],
    contato: [],
    proposta: [],
    negociacao: [],
    fechamento: [],
  }));
  const [showModal, setShowModal] = useState(false);

  const loadBoard = async () => {
    try {
      const res = await inboxApi.get('/opportunities/board');
      setColumns(res.data.data);
    } catch (err) {
      console.error('Erro ao carregar oportunidades', err);
    }
  };

  useEffect(() => { loadBoard(); }, []);

  const onDragEnd = async ({ source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const sourceItems = Array.from(columns[source.droppableId]);
    const [moved] = sourceItems.splice(source.index, 1);
    const destItems = Array.from(columns[destination.droppableId]);
    destItems.splice(destination.index, 0, { ...moved, status: destination.droppableId });
    setColumns((prev) => ({
      ...prev,
      [source.droppableId]: sourceItems,
      [destination.droppableId]: destItems,
    }));
    try {
      await inboxApi.put(`/opportunities/${moved.id}`, { status: destination.droppableId });
    } catch (err) {
      console.error('Erro ao mover oportunidade', err);
      loadBoard();
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Pipeline de Oportunidades</h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          + Nova Oportunidade
        </button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-5 gap-4">
          {STATUSES.map((status) => (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-gray-100 p-2 rounded min-h-[300px]"
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
      {showModal && (
        <OpportunityModal
          onClose={() => setShowModal(false)}
          onSaved={loadBoard}
        />
      )}
    </div>
  );
}


