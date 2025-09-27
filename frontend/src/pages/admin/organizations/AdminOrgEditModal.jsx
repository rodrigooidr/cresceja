import React, { useEffect, useMemo, useState } from "react";
import inboxApi, {
  patchAdminOrg,
  patchAdminOrgCredits,
  putAdminOrgPlan,
} from "../../../api/inboxApi";

function toInputDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

const STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
];

export default function AdminOrgEditModal({ open, org, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    email: "",
    phone: "",
    status: "active",
    plan_id: "",
    trial_ends_at: "",
    document_type: "",
    document_value: "",
    whatsapp_baileys_enabled: false,
    whatsapp_baileys_status: "",
    whatsapp_baileys_phone: "",
    photo_url: "",
    metaText: "",
  });
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [historyForm, setHistoryForm] = useState({
    plan_id: "",
    status: "active",
    start_at: "",
    end_at: "",
    trial_ends_at: "",
    meta: "",
  });
  const [historyMessage, setHistoryMessage] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historySaving, setHistorySaving] = useState(false);

  const [creditsForm, setCreditsForm] = useState({
    feature_code: "",
    delta: "",
    expires_at: "",
    source: "manual",
    meta: "",
  });
  const [creditsMessage, setCreditsMessage] = useState("");
  const [creditsError, setCreditsError] = useState("");
  const [creditsSaving, setCreditsSaving] = useState(false);

  const planMap = useMemo(() => {
    return plans.reduce((acc, plan) => {
      if (plan?.id) acc[plan.id] = plan.name || plan.label || plan.title || plan.id;
      return acc;
    }, {});
  }, [plans]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      try {
        const { data } = await inboxApi.get("/public/plans", { meta: { noAuth: true } });
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setPlans(items);
      } catch (e) {
        if (!cancelled) {
          setPlans([]);
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !org) return;
    setError("");
    setFeedback("");
    setHistoryMessage("");
    setHistoryError("");
    setCreditsMessage("");
    setCreditsError("");

    setForm({
      name: org.name || "",
      slug: org.slug || "",
      email: org.email || "",
      phone: org.phone || "",
      status: org.status || "active",
      plan_id: org.plan_id || "",
      trial_ends_at: toInputDate(org.trial_ends_at),
      document_type: org.document_type || "",
      document_value: org.document_value || "",
      whatsapp_baileys_enabled: !!org.whatsapp_baileys_enabled,
      whatsapp_baileys_status: org.whatsapp_baileys_status || "",
      whatsapp_baileys_phone: org.whatsapp_baileys_phone || "",
      photo_url: org.photo_url || "",
      metaText: org.meta ? JSON.stringify(org.meta, null, 2) : "",
    });
    setHistoryForm((prev) => ({
      ...prev,
      plan_id: org.plan_id || "",
      status: "active",
      start_at: "",
      end_at: "",
      trial_ends_at: toInputDate(org.trial_ends_at),
      meta: "",
    }));
    setCreditsForm({ feature_code: "", delta: "", expires_at: "", source: "manual", meta: "" });
  }, [open, org]);

  if (!open || !org) return null;

  const close = () => {
    if (saving || historySaving || creditsSaving) return;
    onClose?.();
  };

  const handleField = (field) => (event) => {
    const value = event?.target?.type === "checkbox" ? event.target.checked : event?.target?.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHistoryField = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setHistoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreditsField = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setCreditsForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event) => {
    event?.preventDefault();
    setError("");
    setFeedback("");

    if (!form.name.trim()) {
      setError("Nome da organização é obrigatório.");
      return;
    }

    let metaPayload;
    if (form.metaText && form.metaText.trim()) {
      try {
        metaPayload = JSON.parse(form.metaText);
      } catch (e) {
        setError("Meta deve ser um JSON válido.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
        plan_id: form.plan_id || null,
        trial_ends_at: form.trial_ends_at || null,
        document_type: form.document_type || null,
        document_value: form.document_value.trim() || null,
        whatsapp_baileys_enabled: !!form.whatsapp_baileys_enabled,
        whatsapp_baileys_status: form.whatsapp_baileys_status || null,
        whatsapp_baileys_phone: form.whatsapp_baileys_phone.trim() || null,
        photo_url: form.photo_url.trim() || null,
      };
      if (metaPayload !== undefined) {
        payload.meta = metaPayload;
      } else if (form.metaText === "") {
        payload.meta = {};
      }

      const { data } = await patchAdminOrg(org.id, payload);

      if (data?.org) {
        setForm((prev) => ({
          ...prev,
          plan_id: data.org.plan_id || "",
          trial_ends_at: toInputDate(data.org.trial_ends_at),
        }));
        onSaved?.({
          ...org,
          ...data.org,
          plan_name: data.org.plan_name || planMap[data.org.plan_id] || org.plan_name,
        });
      }

      setFeedback("Dados atualizados com sucesso.");
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Falha ao salvar.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const submitPlanHistory = async () => {
    setHistoryError("");
    setHistoryMessage("");

    const nextPlanId = historyForm.plan_id || form.plan_id || null;
    if (!nextPlanId) {
      setHistoryError("Informe um plano para registrar o histórico.");
      return;
    }

    let metaPayload;
    if (historyForm.meta && historyForm.meta.trim()) {
      try {
        metaPayload = JSON.parse(historyForm.meta);
      } catch (e) {
        setHistoryError("Meta (histórico) deve ser JSON válido.");
        return;
      }
    }

    setHistorySaving(true);
    try {
      await putAdminOrgPlan(org.id, {
        plan_id: nextPlanId,
        status: historyForm.status || "active",
        start_at: historyForm.start_at || null,
        end_at: historyForm.end_at || null,
        trial_ends_at: historyForm.trial_ends_at || null,
        meta: metaPayload,
      });

      const nextTrial = historyForm.trial_ends_at || form.trial_ends_at || null;
      setForm((prev) => ({ ...prev, plan_id: nextPlanId || "", trial_ends_at: nextTrial || "" }));
      setHistoryForm((prev) => ({ ...prev, plan_id: nextPlanId || "", meta: "" }));

      onSaved?.({
        ...org,
        plan_id: nextPlanId,
        trial_ends_at: nextTrial,
        plan_name: planMap[nextPlanId] || org.plan_name,
      });

      setHistoryMessage("Histórico registrado com sucesso.");
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Falha ao registrar histórico.";
      setHistoryError(message);
    } finally {
      setHistorySaving(false);
    }
  };

  const submitCredits = async () => {
    setCreditsError("");
    setCreditsMessage("");

    if (!creditsForm.feature_code.trim()) {
      setCreditsError("Informe o código do recurso.");
      return;
    }
    if (!creditsForm.delta) {
      setCreditsError("Informe o delta de créditos.");
      return;
    }

    let metaPayload;
    if (creditsForm.meta && creditsForm.meta.trim()) {
      try {
        metaPayload = JSON.parse(creditsForm.meta);
      } catch (e) {
        setCreditsError("Meta (créditos) deve ser JSON válido.");
        return;
      }
    }

    setCreditsSaving(true);
    try {
      await patchAdminOrgCredits(org.id, {
        feature_code: creditsForm.feature_code.trim(),
        delta: Number(creditsForm.delta),
        expires_at: creditsForm.expires_at || null,
        source: creditsForm.source || null,
        meta: metaPayload,
      });

      setCreditsMessage("Crédito registrado com sucesso.");
      setCreditsForm({ feature_code: "", delta: "", expires_at: "", source: creditsForm.source || "manual", meta: "" });
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Falha ao registrar créditos.";
      setCreditsError(message);
    } finally {
      setCreditsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Editar organização</h2>
            <p className="text-sm text-gray-500">{org.name}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 px-6 py-5">
          {error && <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {feedback && <div className="rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>}

          <section>
            <h3 className="text-lg font-semibold">Dados básicos</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="block text-gray-600">Nome</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.name}
                  onChange={handleField("name")}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Slug</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.slug}
                  onChange={handleField("slug")}
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">E-mail</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.email}
                  onChange={handleField("email")}
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Telefone</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.phone}
                  onChange={handleField("phone")}
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Tipo do documento</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.document_type}
                  onChange={handleField("document_type")}
                >
                  <option value="">—</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Documento</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.document_value}
                  onChange={handleField("document_value")}
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Foto / Logo (URL)</span>
                <input
                  type="url"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.photo_url}
                  onChange={handleField("photo_url")}
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold">Plano e status</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="block text-gray-600">Status</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.status}
                  onChange={handleField("status")}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Plano atual</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.plan_id || ""}
                  onChange={handleField("plan_id")}
                  disabled={plansLoading}
                >
                  <option value="">— Sem plano —</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name || plan.label || plan.id}
                    </option>
                  ))}
                  {form.plan_id && !planMap[form.plan_id] && (
                    <option value={form.plan_id}>{form.plan_id}</option>
                  )}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Trial até</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.trial_ends_at || ""}
                  onChange={handleField("trial_ends_at")}
                />
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.whatsapp_baileys_enabled}
                  onChange={handleField("whatsapp_baileys_enabled")}
                  className="h-4 w-4"
                />
                WhatsApp Baileys habilitado
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="block text-gray-600">Status Baileys</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.whatsapp_baileys_status}
                  onChange={handleField("whatsapp_baileys_status")}
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600">Telefone Baileys</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.whatsapp_baileys_phone}
                  onChange={handleField("whatsapp_baileys_phone")}
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold">Meta (JSON)</h3>
            <textarea
              rows={5}
              className="mt-2 w-full rounded border px-3 py-2 font-mono text-sm"
              value={form.metaText}
              onChange={handleField("metaText")}
              placeholder={`{
  "notes": "..."
}`}
            />
            <p className="mt-1 text-xs text-gray-500">Deixe em branco para manter. Envie um objeto JSON válido.</p>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>

        <div className="border-t px-6 py-5">
          <h3 className="text-lg font-semibold">Registrar mudança de plano</h3>
          {historyError && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{historyError}</div>
          )}
          {historyMessage && (
            <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {historyMessage}
            </div>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="block text-gray-600">Plano</span>
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={historyForm.plan_id || ""}
                onChange={handleHistoryField("plan_id")}
              >
                <option value="">{planMap[form.plan_id] || "— manter atual —"}</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name || plan.label || plan.id}
                  </option>
                ))}
                {form.plan_id && !planMap[form.plan_id] && (
                  <option value={form.plan_id}>{form.plan_id}</option>
                )}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Status do plano</span>
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={historyForm.status}
                onChange={handleHistoryField("status")}
              >
                <option value="active">Ativo</option>
                <option value="canceled">Cancelado</option>
                <option value="suspended">Suspenso</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Início</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-3 py-2"
                value={historyForm.start_at}
                onChange={handleHistoryField("start_at")}
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Término</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-3 py-2"
                value={historyForm.end_at}
                onChange={handleHistoryField("end_at")}
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Trial até</span>
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={historyForm.trial_ends_at || ""}
                onChange={handleHistoryField("trial_ends_at")}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-600">Meta (JSON)</span>
              <textarea
                rows={3}
                className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                value={historyForm.meta}
                onChange={handleHistoryField("meta")}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submitPlanHistory}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              disabled={historySaving}
            >
              {historySaving ? "Registrando…" : "Registrar"}
            </button>
          </div>
        </div>

        <div className="border-t px-6 py-5">
          <h3 className="text-lg font-semibold">Ajustar créditos</h3>
          {creditsError && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{creditsError}</div>
          )}
          {creditsMessage && (
            <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {creditsMessage}
            </div>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="block text-gray-600">feature_code</span>
              <input
                type="text"
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.feature_code}
                onChange={handleCreditsField("feature_code")}
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Delta</span>
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.delta}
                onChange={handleCreditsField("delta")}
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Expira em</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.expires_at}
                onChange={handleCreditsField("expires_at")}
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600">Origem</span>
              <input
                type="text"
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.source}
                onChange={handleCreditsField("source")}
                placeholder="manual | subscription | refund | promo"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-600">Meta (JSON)</span>
              <textarea
                rows={3}
                className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                value={creditsForm.meta}
                onChange={handleCreditsField("meta")}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submitCredits}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={creditsSaving}
            >
              {creditsSaving ? "Aplicando…" : "Aplicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
