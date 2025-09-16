import React from "react";
import inboxApi from "../../../api/inboxApi";

function safeAlert(message) {
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
}

export default function ContactPanel({ phone, name, contact: initialContact = null, onContactLoaded }) {
  const [loading, setLoading] = React.useState(Boolean(phone));
  const [contact, setContact] = React.useState(initialContact);
  const [statuses, setStatuses] = React.useState([]);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ name: name || "", phone: phone || "", email: "", birthday: "" });
  const onLoadedRef = React.useRef(onContactLoaded);

  React.useEffect(() => {
    onLoadedRef.current = onContactLoaded;
  }, [onContactLoaded]);

  React.useEffect(() => {
    setForm((prev) => ({ ...prev, name: name || "", phone: phone || "" }));
  }, [name, phone]);

  React.useEffect(() => {
    if (initialContact) {
      setContact(initialContact);
      setShowForm(false);
    }
  }, [initialContact]);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      if (!phone) {
        setContact(null);
        setShowForm(false);
        setStatuses([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [contactRes, statusesRes] = await Promise.all([
          inboxApi.get(`/crm/contacts?phone=${encodeURIComponent(phone)}`),
          inboxApi.get("/crm/statuses"),
        ]);
        if (!alive) return;
        setStatuses(statusesRes?.data?.items || []);
        if (contactRes?.data?.found) {
          setContact(contactRes.data.contact);
          setShowForm(false);
          onLoadedRef.current?.(contactRes.data.contact);
        } else {
          setContact(null);
          setShowForm(true);
          setForm({ name: name || "", phone: phone || "", email: "", birthday: "" });
        }
      } catch {
        if (!alive) return;
        setContact(null);
        setShowForm(true);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [phone, name]);

  async function saveNew() {
    try {
      const { data } = await inboxApi.post("/crm/contacts", form);
      setContact(data.contact);
      setShowForm(false);
      onLoadedRef.current?.(data.contact);
    } catch (error) {
      if (error?.status === 400 || error?.response?.status === 400) {
        safeAlert("Dados inválidos. Nome, telefone, e-mail e nascimento (YYYY-MM-DD) são obrigatórios.");
      } else {
        safeAlert("Não foi possível salvar o contato.");
      }
    }
  }

  async function savePatch(patch) {
    if (!contact?.id) return;
    try {
      const { data } = await inboxApi.post("/crm/update", { id: contact.id, patch });
      setContact(data.contact);
      onLoadedRef.current?.(data.contact);
    } catch {
      safeAlert("Não foi possível atualizar o contato.");
    }
  }

  if (loading) {
    return <div className="p-3 text-sm">Carregando…</div>;
  }

  if (showForm) {
    return (
      <div className="p-3 space-y-2" data-testid="crm-form">
        <div className="font-semibold">Cadastrar cliente</div>
        <input
          className="border px-2 py-1 w-full text-sm"
          placeholder="Nome"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          className="border px-2 py-1 w-full text-sm"
          placeholder="Telefone (+5511999999999)"
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
        />
        <input
          className="border px-2 py-1 w-full text-sm"
          placeholder="E-mail"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
        />
        <input
          className="border px-2 py-1 w-full text-sm"
          placeholder="Nascimento (YYYY-MM-DD)"
          value={form.birthday}
          onChange={(event) => setForm((prev) => ({ ...prev, birthday: event.target.value }))}
        />
        <button className="border px-3 py-1 text-sm" onClick={saveNew} data-testid="crm-save">
          Salvar
        </button>
      </div>
    );
  }

  if (!contact) {
    return <div className="p-3 text-sm opacity-70">Sem dados de contato.</div>;
  }

  return (
    <div className="p-3 space-y-2" data-testid="crm-panel">
      <div className="font-semibold">Cliente: {contact.name || name || phone}</div>
      <div className="text-xs opacity-70">{contact.phone}</div>
      <div className="text-xs opacity-70">{contact.email}</div>
      <div className="text-xs opacity-70">{contact.birthday}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs">Status:</span>
        <select
          className="text-sm border px-1 py-0.5"
          value={contact.status || ""}
          onChange={(event) => savePatch({ status: event.target.value })}
          data-testid="crm-status"
        >
          <option value="">–</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <div className="text-xs">Outras informações</div>
        <textarea
          className="w-full border px-2 py-1 text-sm"
          rows={4}
          value={contact.notes || ""}
          onChange={(event) => savePatch({ notes: event.target.value })}
        />
      </div>
    </div>
  );
}
