import React, { useEffect, useState } from "react";
import inboxApi from "../../api/inboxApi";


export default function AdminQuickReplies() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", body: "" });

  const load = async () => {
    try {
      const { data } = await inboxApi.get("/quick-replies");
      const list = Array.isArray(data?.templates) ? data.templates : [];
      setItems(list);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.title || !form.body) return;
    await inboxApi.post("/quick-replies", form);
    setForm({ title: "", body: "" });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir esta resposta?")) return;
    await inboxApi.delete(`/quick-replies/${id}`);
    load();
  };

  const edit = async (id) => {
    const cur = items.find((i) => i.id === id);
    const title = prompt("Título:", cur?.title || "");
    if (title === null) return;
    const body = prompt("Texto:", cur?.body || "");
    if (body === null) return;
    await inboxApi.put(`/quick-replies/${id}`, { title, body });
    load();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Respostas Rápidas</h1>

      <div className="space-y-3">
        {items.map((it) => (
          <div
            key={it.id}
            className="border rounded-lg p-3 flex justify-between items-start gap-3"
          >
            <div>
              <div className="font-medium">{it.title}</div>
              <div className="text-sm text-gray-600 whitespace-pre-line">
                {it.body}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => edit(it.id)}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={() => remove(it.id)}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="text-sm text-gray-500">Nenhuma resposta.</div>
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        <h2 className="font-semibold">Nova resposta</h2>
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="Título"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          className="w-full border rounded px-2 py-1"
          rows={3}
          placeholder="Texto"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        <button
          onClick={save}
          className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
