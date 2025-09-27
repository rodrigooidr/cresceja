import { useEffect, useMemo, useState } from "react";
import { adminListOrgs, adminListPlans, patchAdminOrg } from "@/api/inboxApi";

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

function EditOrgModal({ org, onClose, onSaved }) {
  const [form, setForm] = useState({ plan_id: "", status: "active", trial_ends_at: "" });
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org) return;
    setForm({
      plan_id: org.plan_id || "",
      status: org.status || "active",
      trial_ends_at: toInputDate(org.trial_ends_at),
    });
  }, [org]);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    setLoadingPlans(true);
    (async () => {
      try {
        const data = await adminListPlans();
        if (!cancelled) {
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.plans)
            ? data.plans
            : [];
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

  const handleChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const close = () => {
    if (saving) return;
    onClose?.();
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        plan_id: form.plan_id || null,
        status: form.status || "active",
        trial_ends_at: form.trial_ends_at || null,
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
      const planId = merged.plan_id ?? payload.plan_id ?? org.plan_id ?? null;
      const next = {
        ...merged,
        plan_id: planId,
        plan_name: planMap[planId] || merged.plan_name || org.plan_name || null,
      };
      onSaved?.(next);
      onClose?.();
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Falha ao salvar.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Editar organização</h2>
        <p className="mt-1 text-sm text-gray-500">{org.name}</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <label className="block text-sm">
            <span className="text-gray-600">Plano</span>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.plan_id || ""}
              onChange={handleChange("plan_id")}
              disabled={loadingPlans || saving}
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
          <label className="block text-sm">
            <span className="text-gray-600">Status</span>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.status}
              onChange={handleChange("status")}
              disabled={saving}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Trial até</span>
            <input
              type="date"
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.trial_ends_at || ""}
              onChange={handleChange("trial_ends_at")}
              disabled={saving}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded border px-4 py-2 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Salvando…" : "Salvar"}
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminListOrgs({ status: tab });
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const handleSaved = (updatedOrg) => {
    if (!updatedOrg?.id) return;
    setItems((prev) =>
      prev.map((org) => (org.id === updatedOrg.id ? { ...org, ...updatedOrg } : org))
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
              <td>{org.plan_name ?? "—"}</td>
              <td>{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : "—"}</td>
              <td>{org.status === "active" ? "Ativa" : "Inativa"}</td>
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
