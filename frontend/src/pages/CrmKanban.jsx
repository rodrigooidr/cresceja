import inboxApi from "../../api/inboxApi";
import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../contexts/useApi';

/**
 * Kanban de Oportunidades do CRM com agendamento
 * - Adiciona botão "Agendar" em cada card
 * - Abre modal para escolher título e data/hora
 * - Faz POST /api/agenda e mostra feedback
 */
const COLUNAS = [
  { key: 'novo', label: 'Novo' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'ganho', label: 'Ganho' },
  { key: 'perdido', label: 'Perdido' }
];

function Modal({ open, onClose, onConfirm, values, setValues }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded p-4 shadow">
        <h3 className="font-semibold text-lg mb-3">Agendar contato</h3>
        <div className="space-y-3">
          <input
            className="w-full border p-2 rounded"
            placeholder="Título"
            value={values.title}
            onChange={e => setValues(v => ({ ...v, title: e.target.value }))}
          />
          <input
            className="w-full border p-2 rounded"
            type="datetime-local"
            value={values.date}
            onChange={e => setValues(v => ({ ...v, date: e.target.value }))}
          />
          <select
            className="w-full border p-2 rounded"
            value={values.channel}
            onChange={e => setValues(v => ({ ...v, channel: e.target.value }))}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-2 rounded bg-gray-200">Cancelar</button>
            <button onClick={onConfirm} className="px-3 py-2 rounded bg-blue-600 text-white">Agendar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrmKanban() {
  const api = useApi();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [arrastando, setArrastando] = useState(null); // id do item arrastado
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [agendarDe, setAgendarDe] = useState(null); // card selecionado para agendar
  const [form, setForm] = useState({ title: '', date: '', channel: 'whatsapp' });

  const carregar = async () => {
    try {
      setCarregando(true);
      const res = await inboxApi.get('/crm/oportunidades');
      setItens(res.data);
      setErro('');
    } catch (e) {
      console.error(e);
      setErro('Erro ao carregar oportunidades.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const porColuna = useMemo(() => {
    const map = { novo: [], em_andamento: [], ganho: [], perdido: [] };
    for (const it of itens) {
      const k = COLUNAS.find(c => c.key === it.status) ? it.status : 'novo';
      map[k].push(it);
    }
    return map;
  }, [itens]);

  const onDragStart = (e, id) => {
    setArrastando(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = async (e, colunaDestino) => {
    e.preventDefault();
    const id = arrastando || e.dataTransfer.getData('text/plain');
    if (!id) return;

    // Atualização otimista
    setItens(prev => prev.map(i => i.id === id ? { ...i, status: colunaDestino } : i));

    try {
      await inboxApi.put(`/crm/oportunidades/${id}`, { status: colunaDestino });
    } catch (err) {
      console.error('Erro ao atualizar status', err);
      // desfaz se falhar
      await carregar();
    } finally {
      setArrastando(null);
    }
  };

  const abrirAgendar = (card) => {
    setAgendarDe(card);
    setForm({
      title: `Contato com ${card.name}`,
      date: '',
      channel: 'whatsapp'
    });
    setOk('');
    setErro('');
  };

  const confirmarAgendar = async () => {
    if (!form.title || !form.date) {
      setErro('Preencha título e data.');
      return;
    }
    try {
      await inboxApi.post('/agenda', {
        title: form.title,
        date: form.date,
        channel: form.channel,
        // opcional: payload extra para confirmação por WhatsApp
        contact: { name: agendarDe.name, whatsapp: agendarDe.whatsapp },
        opportunity_id: agendarDe.id
      });
      setOk('Agendamento criado com sucesso!');
      setAgendarDe(null);
    } catch (e) {
      console.error(e);
      setErro('Falha ao criar agendamento.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">CRM • Funil (Kanban)</h2>
        <button
          onClick={carregar}
          className="text-sm px-3 py-2 bg-gray-200 rounded"
        >
          Atualizar
        </button>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}
      {ok && <p className="text-green-600 text-sm mb-3">{ok}</p>}

      {carregando ? (
        <p>Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUNAS.map(col => (
            <div
              key={col.key}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, col.key)}
              className="bg-gray-50 rounded-lg border p-3 min-h-[60vh]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{col.label}</h3>
                <span className="text-xs text-gray-500">
                  {porColuna[col.key]?.length || 0}
                </span>
              </div>

              <div className="space-y-2">
                {(porColuna[col.key] || []).map(card => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, card.id)}
                    className={"bg-white rounded shadow p-3 border " + (arrastando === card.id ? "opacity-70 ring-2 ring-blue-400" : "")}
                    title={card.email}
                  >
                    <p className="font-medium">{card.name}</p>
                    <p className="text-xs text-gray-500">{card.email || 'sem e-mail'} · {card.whatsapp || 'sem whatsapp'}</p>
                    <p className="text-[11px] text-gray-400 mt-1">Canal: {card.channel || '-'}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => abrirAgendar(card)}
                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                      >
                        Agendar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!agendarDe}
        onClose={() => setAgendarDe(null)}
        onConfirm={confirmarAgendar}
        values={form}
        setValues={setForm}
      />
    </div>
  );
}

export default CrmKanban;

