import { useEffect, useMemo, useState } from "react";
import {
  adminListOrgs,
  adminListPlans,
  patchAdminOrg,
  patchAdminOrgCredits,
  putAdminOrgPlan,
} from "@/api/inboxApi";
import useToastFallback from "@/hooks/useToastFallback";

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

const ORG_STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
];

const PLAN_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "pending", label: "Pendente" },
  { value: "suspended", label: "Suspenso" },
  { value: "canceled", label: "Cancelado" },
];

function fromInputDate(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function normalizeOrgData(org) {
  if (!org || typeof org !== "object") return org;
  const active = typeof org.active === "boolean" ? org.active : org.status === "active";
  const statusValue =
    org.status ?? (typeof active === "boolean" ? (active ? "active" : "inactive") : undefined);
  return { ...org, active, status: statusValue };
}

function fromInputDateTime(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function EditOrgModal({ org, onClose, onSaved }) {
  const [basicForm, setBasicForm] = useState({
    name: "",
    slug: "",
    status: "active",
    email: "",
    phone: "",
    trial_ends_at: "",
  });
  const [planForm, setPlanForm] = useState({
    plan_id: "",
    status: "active",
    start_at: "",
    end_at: "",
    trial_ends_at: "",
    meta: "",
  });
  const [creditsForm, setCreditsForm] = useState({
    feature_code: "",
    delta: "",
    expires_at: "",
    source: "manual",
    meta: "",
  });
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingCredits, setSavingCredits] = useState(false);
  const [basicError, setBasicError] = useState("");
  const [basicSuccess, setBasicSuccess] = useState("");
  const [planError, setPlanError] = useState("");
  const [planSuccess, setPlanSuccess] = useState("");
  const [creditsError, setCreditsError] = useState("");
  const [creditsSuccess, setCreditsSuccess] = useState("");

  useEffect(() => {
    if (!org) return;
    setBasicForm({
      name: org.name || "",
      slug: org.slug || "",
      status: org.status || "active",
      email: org.email || "",
      phone: org.phone || "",
      trial_ends_at: toInputDate(org.trial_ends_at),
    });
    setPlanForm((prev) => ({
      ...prev,
      plan_id: org.plan_id || "",
      status: org.status === "inactive" ? "suspended" : "active",
      trial_ends_at: toInputDate(org.trial_ends_at),
    }));
    setCreditsForm((prev) => ({ ...prev, feature_code: "", delta: "", expires_at: "", meta: "" }));
    setBasicError("");
    setBasicSuccess("");
    setPlanError("");
    setPlanSuccess("");
    setCreditsError("");
    setCreditsSuccess("");
  }, [org]);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    setLoadingPlans(true);
    (async () => {
      try {
        const { plans: planList } = await adminListPlans();
        if (!cancelled) {
          const list = Array.isArray(planList) ? planList : [];
          setPlans(list);
        }
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org]);

  const planMap = useMemo(() => {
    return plans.reduce((acc, plan) => {
      const label = plan?.name || plan?.title || plan?.label || plan?.id || plan?.slug;
      if (!label) return acc;
      if (plan?.id) acc[plan.id] = label;
      if (plan?.slug) acc[plan.slug] = label;
      if (plan?.id_legacy_text) acc[plan.id_legacy_text] = label;
      return acc;
    }, {});
  }, [plans]);

  if (!org) return null;

  const close = () => {
    if (savingBasic || savingPlan || savingCredits) return;
    onClose?.();
  };

  const handleBasicChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setBasicForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlanChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setPlanForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreditsChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setCreditsForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitBasic = async (event) => {
    event?.preventDefault();
    if (savingBasic) return;
    setBasicError("");
    setBasicSuccess("");
    setSavingBasic(true);
    try {
      const payload = {
        name: basicForm.name?.trim() || org.name || "",
        slug: basicForm.slug?.trim() || null,
        status: basicForm.status || "active",
        email: basicForm.email?.trim() || null,
        phone: basicForm.phone?.trim() || null,
        trial_ends_at: fromInputDate(basicForm.trial_ends_at),
      };
      const response = await patchAdminOrg(org.id, payload);
      const data = response?.data;
      const merged = {
        ...org,
        ...(data?.org || {}),
        ...(Array.isArray(data?.data) ? {} : data?.data || {}),
        ...(!data?.org && !data?.data ? data || {} : {}),
        ...payload,
      };
      onSaved?.({ ...org, ...merged });
      setBasicSuccess("Dados atualizados com sucesso.");
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Falha ao salvar.";
      setBasicError(message);
    } finally {
      setSavingBasic(false);
    }
  };

  const submitPlan = async (event) => {
    event?.preventDefault();
    if (savingPlan) return;
    setPlanError("");
    setPlanSuccess("");
    if (!planForm.plan_id) {
      setPlanError("Selecione um plano.");
      return;
    }
    let parsedMeta;
    if (planForm.meta) {
      try {
        parsedMeta = JSON.parse(planForm.meta);
      } catch {
        setPlanError("Meta deve ser um JSON válido.");
        return;
      }
    }
    setSavingPlan(true);
    try {
      const payload = {
        plan_id: planForm.plan_id,
        status: planForm.status || "active",
        start_at: fromInputDateTime(planForm.start_at),
        end_at: fromInputDateTime(planForm.end_at),
        trial_ends_at: fromInputDate(planForm.trial_ends_at),
        meta: parsedMeta,
      };
      await putAdminOrgPlan(org.id, payload);
      onSaved?.({
        ...org,
        plan_id: payload.plan_id,
        plan_name: planMap[payload.plan_id] || org.plan_name || null,
        trial_ends_at: payload.trial_ends_at ?? org.trial_ends_at ?? null,
      });
      setPlanSuccess("Plano atualizado com sucesso.");
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Não foi possível atualizar o plano.";
      setPlanError(message);
    } finally {
      setSavingPlan(false);
    }
  };

  const submitCredits = async (event) => {
    event?.preventDefault();
    if (savingCredits) return;
    setCreditsError("");
    setCreditsSuccess("");
    const feature = creditsForm.feature_code?.trim();
    if (!feature) {
      setCreditsError("Informe o código da feature.");
      return;
    }
    const deltaNumber = Number(creditsForm.delta);
    if (!Number.isFinite(deltaNumber)) {
      setCreditsError("Delta deve ser um número.");
      return;
    }
    let meta;
    if (creditsForm.meta) {
      try {
        meta = JSON.parse(creditsForm.meta);
      } catch {
        setCreditsError("Meta deve ser JSON válido.");
        return;
      }
    }
    setSavingCredits(true);
    try {
      const payload = {
        feature_code: feature,
        delta: Math.trunc(deltaNumber),
        expires_at: fromInputDateTime(creditsForm.expires_at),
        source: creditsForm.source?.trim() || undefined,
        meta,
      };
      await patchAdminOrgCredits(org.id, payload);
      setCreditsSuccess("Créditos registrados.");
      setCreditsForm((prev) => ({
        ...prev,
        feature_code: "",
        delta: "",
        expires_at: "",
        meta: "",
      }));
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Não foi possível registrar créditos.";
      setCreditsError(message);
    } finally {
      setSavingCredits(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Editar organização</h2>
            <p className="mt-1 text-sm text-gray-500">{org.name}</p>
          </div>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-800"
            onClick={close}
            disabled={savingBasic || savingPlan || savingCredits}
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <form
            onSubmit={submitBasic}
            className="space-y-3"
            data-testid="admin-org-basic-form"
          >
            <h3 className="font-medium">Dados básicos</h3>
            {basicError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {basicError}
              </div>
            )}
            {basicSuccess && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {basicSuccess}
              </div>
            )}
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Nome
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={basicForm.name}
                onChange={handleBasicChange("name")}
                disabled={savingBasic}
                data-testid="admin-org-basic-name"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Slug
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={basicForm.slug}
                onChange={handleBasicChange("slug")}
                disabled={savingBasic}
                data-testid="admin-org-basic-slug"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              E-mail
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={basicForm.email}
                onChange={handleBasicChange("email")}
                disabled={savingBasic}
                data-testid="admin-org-basic-email"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Telefone
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={basicForm.phone}
                onChange={handleBasicChange("phone")}
                disabled={savingBasic}
                data-testid="admin-org-basic-phone"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Status
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={basicForm.status}
                onChange={handleBasicChange("status")}
                disabled={savingBasic}
              >
                {ORG_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Trial até
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={basicForm.trial_ends_at || ""}
                onChange={handleBasicChange("trial_ends_at")}
                disabled={savingBasic}
              />
            </label>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                disabled={savingBasic}
                data-testid="admin-org-basic-save"
              >
                {savingBasic ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>

          <form
            onSubmit={submitPlan}
            className="space-y-3"
            data-testid="admin-org-plan-form"
          >
            <h3 className="font-medium">Plano</h3>
            {planError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {planError}
              </div>
            )}
            {planSuccess && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {planSuccess}
              </div>
            )}
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Plano
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={planForm.plan_id}
                onChange={handlePlanChange("plan_id")}
                disabled={loadingPlans || savingPlan}
                data-testid="admin-org-plan-select"
              >
                <option value="">—</option>
                {plans.map((plan) => {
                  const value = plan.id || plan.slug || plan.id_legacy_text || "";
                  const label = plan.name || plan.title || plan.label || value;
                  return (
                    <option key={value || plan.name} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Status do histórico
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={planForm.status}
                onChange={handlePlanChange("status")}
                disabled={savingPlan}
                data-testid="admin-org-plan-status"
              >
                {PLAN_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Trial até
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={planForm.trial_ends_at || ""}
                onChange={handlePlanChange("trial_ends_at")}
                disabled={savingPlan}
                data-testid="admin-org-plan-trial"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Início
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-3 py-2"
                value={planForm.start_at}
                onChange={handlePlanChange("start_at")}
                disabled={savingPlan}
                data-testid="admin-org-plan-start"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Encerramento
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-3 py-2"
                value={planForm.end_at}
                onChange={handlePlanChange("end_at")}
                disabled={savingPlan}
                data-testid="admin-org-plan-end"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Meta (JSON opcional)
              <textarea
                className="mt-1 h-24 w-full rounded border px-3 py-2 text-sm"
                value={planForm.meta}
                onChange={handlePlanChange("meta")}
                disabled={savingPlan}
                data-testid="admin-org-plan-meta"
              />
            </label>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                disabled={savingPlan}
                data-testid="admin-org-plan-save"
              >
                {savingPlan ? "Registrando…" : "Registrar plano"}
              </button>
            </div>
          </form>
        </div>

        <form
          onSubmit={submitCredits}
          className="mt-6 space-y-3"
          data-testid="admin-org-credits-form"
        >
          <h3 className="font-medium">Créditos</h3>
          <p className="text-xs text-gray-500">
            Ajuste manual de créditos para recursos específicos da organização.
          </p>
          {creditsError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {creditsError}
            </div>
          )}
          {creditsSuccess && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {creditsSuccess}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Feature
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.feature_code}
                onChange={handleCreditsChange("feature_code")}
                disabled={savingCredits}
                data-testid="admin-org-credits-feature"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Delta
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.delta}
                onChange={handleCreditsChange("delta")}
                disabled={savingCredits}
                data-testid="admin-org-credits-delta"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Expira em
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.expires_at}
                onChange={handleCreditsChange("expires_at")}
                disabled={savingCredits}
                data-testid="admin-org-credits-expires"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              Fonte
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={creditsForm.source}
                onChange={handleCreditsChange("source")}
                disabled={savingCredits}
                data-testid="admin-org-credits-source"
              />
            </label>
          </div>
          <label className="block text-xs uppercase tracking-wide text-gray-500">
            Meta (JSON opcional)
            <textarea
              className="mt-1 h-24 w-full rounded border px-3 py-2 text-sm"
              value={creditsForm.meta}
              onChange={handleCreditsChange("meta")}
              disabled={savingCredits}
              data-testid="admin-org-credits-meta"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={savingCredits}
              data-testid="admin-org-credits-save"
            >
              {savingCredits ? "Registrando…" : "Aplicar créditos"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminOrganizationsPage() {
  const [tab, setTab] = useState("active");
  const [items, setItems] = useState([]);
  const [editingOrg, setEditingOrg] = useState(null);
  const [error, setError] = useState("");
  const toast = useToastFallback();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminListOrgs({ status: tab });
        if (!cancelled) {
          const list = Array.isArray(data) ? data.map(normalizeOrgData) : [];
          setItems(list);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          const message = err?.message || "Não foi possível carregar as organizações.";
          setError(message);
          toast({ title: "Erro ao carregar organizações", description: message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, toast]);

  const handleSaved = (updatedOrg) => {
    if (!updatedOrg?.id) return;
    setItems((prev) =>
      prev.map((org) => (org.id === updatedOrg.id ? { ...org, ...normalizeOrgData(updatedOrg) } : org))
    );
    setEditingOrg(null);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        {[
          { value: "active", label: "Ativas" },
          { value: "inactive", label: "Inativas" },
          { value: "all", label: "Todas" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={`rounded-full border px-4 py-1 text-sm ${
              tab === option.value
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-blue-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Plano</th>
            <th>Trial</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((org) => (
            <tr key={org.id}>
              <td>
                <div className="font-medium">{org.name}</div>
                <div className="text-xs text-gray-500">{org.slug}</div>
              </td>
              <td>{org.plan_name ?? org.plan_id ?? "—"}</td>
              <td>{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : "—"}</td>
              <td>{org.active ? "Ativa" : "Inativa"}</td>
              <td>
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={() => setEditingOrg(org)}
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-gray-500">
                Nenhuma organização.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editingOrg && (
        <EditOrgModal
          org={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
