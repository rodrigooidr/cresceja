import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminCreatePlan,
  adminDeletePlan,
  adminDuplicatePlan,
  adminListPlans,
  adminUpdatePlan,
} from "@/api/inboxApi";
import { hasGlobalRole } from "@/auth/roles";
import { useAuth } from "@/contexts/AuthContext";

const AI_METER_OPTIONS = [
  { value: "", label: "Selecione" },
  { value: "content_tokens", label: "Tokens de conteúdo" },
  { value: "assist_tokens", label: "Tokens do assistente" },
  { value: "speech_seconds", label: "Segundos de fala" },
];

function formatCurrencyDisplay(currency, cents) {
  const safeCurrency = currency || "BRL";
  if (cents === null || cents === undefined) return "";
  const value = Number(cents) / 100;
  try {
    const locale = safeCurrency === "USD" ? "en-US" : "pt-BR";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }
}

function computePriceState(raw, currency) {
  const stringValue = raw == null ? "" : String(raw);
  const digits = stringValue.replace(/[^0-9]/g, "");
  const cents = digits ? Number(digits) : 0;
  return { cents, display: formatCurrencyDisplay(currency, cents) };
}

function normalizeEnumOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore JSON parse errors and fallback to comma separated values
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractFeatureValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.prototype.hasOwnProperty.call(raw, "value")) {
      return raw.value;
    }
  }
  return raw;
}

function buildPlanFeaturesMap(planFeatures = []) {
  const map = {};
  for (const entry of Array.isArray(planFeatures) ? planFeatures : []) {
    if (!entry || !entry.plan_id || !entry.feature_code) continue;
    if (!map[entry.plan_id]) map[entry.plan_id] = {};
    map[entry.plan_id][entry.feature_code] = {
      value: extractFeatureValue(entry.value),
      ai_meter_code: entry.ai_meter_code ?? null,
      ai_monthly_quota: entry.ai_monthly_quota ?? null,
      value_type: entry.value_type ?? null,
    };
  }
  return map;
}

function supportsAi(def) {
  if (!def) return false;
  if (def.supports_ai) return true;
  if (def.metadata && typeof def.metadata === "object" && def.metadata.supports_ai) return true;
  if (typeof def.category === "string" && def.category.toLowerCase().includes("ai")) return true;
  return false;
}

function buildFeatureForm(defs = [], planId, featuresByPlan = {}) {
  if (!planId || !Array.isArray(defs)) return [];
  const byPlan = featuresByPlan[planId] || {};
  return defs
    .map((def) => {
      if (!def || !def.code) return null;
      const stored = byPlan[def.code] || {};
      const type = def.type ?? "string";
      const options = normalizeEnumOptions(def.enum_options);
      let value;
      if (type === "boolean") {
        value = stored.value === null || stored.value === undefined ? false : Boolean(stored.value);
      } else if (type === "number") {
        value = stored.value === null || stored.value === undefined ? "" : String(stored.value);
      } else if (type === "enum") {
        const defaultValue = options.length ? options[0] : "";
        value = stored.value === null || stored.value === undefined ? defaultValue : String(stored.value);
      } else {
        value = stored.value === null || stored.value === undefined ? "" : String(stored.value);
      }
      return {
        code: def.code,
        label: def.label ?? def.code,
        type,
        category: def.category ?? "geral",
        options,
        sort_order: def.sort_order ?? 0,
        value,
        supportsAi: supportsAi(def),
        ai_meter_code: stored.ai_meter_code ?? "",
        ai_monthly_quota:
          stored.ai_monthly_quota === null || stored.ai_monthly_quota === undefined
            ? ""
            : String(stored.ai_monthly_quota),
      };
    })
    .filter(Boolean);
}

function groupFeaturesByCategory(list = []) {
  const map = new Map();
  for (const feature of list) {
    const category = feature.category || "geral";
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(feature);
  }
  return Array.from(map.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => {
        const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (order !== 0) return order;
        return a.label.localeCompare(b.label);
      }),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function featureToPayload(feature) {
  const payload = { feature_code: feature.code };
  if (feature.type === "boolean") {
    payload.value_bool = Boolean(feature.value);
  } else if (feature.type === "number") {
    if (feature.value === null || feature.value === undefined || feature.value === "") {
      payload.value_number = null;
    } else {
      const normalized = Number(String(feature.value).replace(/,/g, "."));
      payload.value_number = Number.isFinite(normalized) ? normalized : null;
    }
  } else if (feature.type === "enum" || feature.type === "string") {
    payload.value = feature.value ?? "";
  } else {
    payload.value = feature.value;
  }

  if (feature.supportsAi || feature.ai_meter_code || feature.ai_monthly_quota) {
    payload.ai_meter_code = feature.ai_meter_code ? feature.ai_meter_code : null;
    if (feature.ai_monthly_quota === null || feature.ai_monthly_quota === undefined || feature.ai_monthly_quota === "") {
      payload.ai_monthly_quota = null;
    } else {
      const quota = Number(String(feature.ai_monthly_quota).replace(/,/g, "."));
      payload.ai_monthly_quota = Number.isFinite(quota) ? quota : null;
    }
  }

  return payload;
}

function createModalState() {
  return {
    name: "",
    currency: "BRL",
    price_cents: 0,
    priceInput: formatCurrencyDisplay("BRL", 0),
    is_active: true,
  };
}

function formatCategoryLabel(category) {
  const text = category || "geral";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function PlansPage() {
  const { user } = useAuth();
  const canView = useMemo(() => hasGlobalRole(["SuperAdmin", "Support"], user), [user]);

  const [plans, setPlans] = useState([]);
  const [featureDefs, setFeatureDefs] = useState([]);
  const [featuresByPlan, setFeaturesByPlan] = useState({});
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const [form, setForm] = useState({
    name: "",
    currency: "BRL",
    price_cents: 0,
    priceInput: formatCurrencyDisplay("BRL", 0),
    is_active: true,
  });
  const [featureForm, setFeatureForm] = useState([]);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState(createModalState);
  const [modalError, setModalError] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const { plans: planList, feature_defs, plan_features } = await adminListPlans();
      const safePlans = Array.isArray(planList) ? planList : [];
      setPlans(safePlans);
      setFeatureDefs(Array.isArray(feature_defs) ? feature_defs : []);
      setFeaturesByPlan(buildPlanFeaturesMap(plan_features));
      setPlansError("");
      setActionError("");
      if (safePlans.length) {
        setSelectedPlanId((current) => {
          if (current && safePlans.some((plan) => plan.id === current)) return current;
          return safePlans[0].id;
        });
      } else {
        setSelectedPlanId(null);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Não foi possível carregar os planos.";
      setPlansError(message);
      setPlans([]);
      setFeatureDefs([]);
      setFeaturesByPlan({});
      setSelectedPlanId(null);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      setPlans([]);
      setFeatureDefs([]);
      setFeaturesByPlan({});
      setPlansLoading(false);
      setPlansError("");
      setSelectedPlanId(null);
      return;
    }
    loadPlans();
  }, [canView, loadPlans]);

  useEffect(() => {
    if (!selectedPlan) {
      setForm({
        name: "",
        currency: "BRL",
        price_cents: 0,
        priceInput: formatCurrencyDisplay("BRL", 0),
        is_active: true,
      });
      setFeatureForm([]);
      setDirty(false);
      setSaveError("");
      setSaveSuccess(false);
      return;
    }
    const currency = selectedPlan.currency || "BRL";
    const priceCents = Number(selectedPlan.price_cents ?? 0);
    setForm({
      name: selectedPlan.name || "",
      currency,
      price_cents: priceCents,
      priceInput: formatCurrencyDisplay(currency, priceCents),
      is_active: Boolean(selectedPlan.is_active),
    });
    setFeatureForm(buildFeatureForm(featureDefs, selectedPlan.id, featuresByPlan));
    setDirty(false);
    setSaveError("");
    setSaveSuccess(false);
  }, [selectedPlan, featureDefs, featuresByPlan]);

  const groupedFeatures = useMemo(() => groupFeaturesByCategory(featureForm), [featureForm]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError("");
    setSaveSuccess(false);
  }, []);

  const applyFeatureUpdate = useCallback(
    (code, updater) => {
      setFeatureForm((prev) => prev.map((item) => (item.code === code ? { ...item, ...updater(item) } : item)));
      markDirty();
    },
    [markDirty]
  );

  const handleNameChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, name: value }));
    markDirty();
  };

  const handleCurrencyChange = (event) => {
    const currency = event.target.value;
    setForm((prev) => ({
      ...prev,
      currency,
      priceInput: formatCurrencyDisplay(currency, prev.price_cents),
    }));
    markDirty();
  };

  const handlePriceChange = (event) => {
    const { cents, display } = computePriceState(event.target.value, form.currency);
    setForm((prev) => ({ ...prev, price_cents: cents, priceInput: display }));
    markDirty();
  };

  const handleActiveToggle = (event) => {
    setForm((prev) => ({ ...prev, is_active: event.target.checked }));
    markDirty();
  };

  const handleFeatureBooleanChange = useCallback(
    (code, checked) => {
      applyFeatureUpdate(code, () => ({ value: checked }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureNumberChange = useCallback(
    (code, raw) => {
      const sanitized = raw.replace(/[^0-9.,-]/g, "");
      applyFeatureUpdate(code, () => ({ value: sanitized }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureTextChange = useCallback(
    (code, value) => {
      applyFeatureUpdate(code, () => ({ value }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureAiMeterChange = useCallback(
    (code, meter) => {
      applyFeatureUpdate(code, () => ({ ai_meter_code: meter }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureAiQuotaChange = useCallback(
    (code, raw) => {
      const sanitized = raw.replace(/[^0-9.,]/g, "");
      applyFeatureUpdate(code, () => ({ ai_monthly_quota: sanitized }));
    },
    [applyFeatureUpdate]
  );
  const handleSave = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      const payload = {
        name: form.name,
        price_cents: form.price_cents,
        currency: form.currency,
        is_active: form.is_active,
        features: featureForm.map(featureToPayload),
      };
      await adminUpdatePlan(selectedPlanId, payload);
      await loadPlans();
      setSaveSuccess(true);
      setDirty(false);
    } catch (error) {
      const code = error?.response?.data?.error;
      const message =
        code === "invalid_ai_meter_code"
          ? "Medidor de IA inválido."
          : code === "invalid_ai_quota"
          ? "Cota de IA inválida."
          : error?.message || "Falha ao salvar plano.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedPlanId) return;
    setActionLoading(true);
    setActionError("");
    try {
      const response = await adminDuplicatePlan(selectedPlanId);
      const newId = response?.data?.data?.plan?.id;
      await loadPlans();
      if (newId) setSelectedPlanId(newId);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Falha ao duplicar plano.";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlanId) return;
    if (!window.confirm("Deseja realmente excluir este plano?")) return;
    setActionLoading(true);
    setActionError("");
    try {
      await adminDeletePlan(selectedPlanId);
      await loadPlans();
    } catch (error) {
      const message =
        error?.response?.status === 409
          ? "Plano em uso por organizações"
          : error?.response?.data?.error || error?.message || "Falha ao excluir plano.";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = () => {
    setModalForm(createModalState());
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (modalSaving) return;
    setModalOpen(false);
    setModalError("");
  };

  const handleModalNameChange = (event) => {
    setModalForm((prev) => ({ ...prev, name: event.target.value }));
  };

  const handleModalCurrencyChange = (event) => {
    const currency = event.target.value;
    setModalForm((prev) => ({
      ...prev,
      currency,
      priceInput: formatCurrencyDisplay(currency, prev.price_cents),
    }));
  };

  const handleModalPriceChange = (event) => {
    const { cents, display } = computePriceState(event.target.value, modalForm.currency);
    setModalForm((prev) => ({ ...prev, price_cents: cents, priceInput: display }));
  };

  const handleModalActiveToggle = (event) => {
    setModalForm((prev) => ({ ...prev, is_active: event.target.checked }));
  };

  const handleCreatePlanAction = async () => {
    setModalError("");
    const name = modalForm.name.trim();
    if (!name) {
      setModalError("Informe o nome do plano.");
      return;
    }
    setModalSaving(true);
    try {
      const response = await adminCreatePlan({
        name,
        currency: modalForm.currency,
        price_cents: modalForm.price_cents,
        is_active: modalForm.is_active,
      });
      const newId = response?.data?.data?.plan?.id;
      setModalOpen(false);
      setModalForm(createModalState());
      await loadPlans();
      if (newId) setSelectedPlanId(newId);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || "Falha ao criar plano.";
      setModalError(message);
    } finally {
      setModalSaving(false);
    }
  };

  if (!canView) {
    return (
      <div style={{ padding: "24px" }}>
        <h1>Planos</h1>
        <p>Você não possui permissão para visualizar os planos.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px" }}>
      <h1 style={{ marginBottom: "16px" }}>Planos</h1>
      {plansError && (
        <div style={{ marginBottom: "16px", color: "#b91c1c" }}>{plansError}</div>
      )}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        <aside style={{ width: "260px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            <button type="button" onClick={openModal} disabled={plansLoading || actionLoading}>
              Novo
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={!selectedPlanId || actionLoading || plansLoading}
            >
              Duplicar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!selectedPlanId || actionLoading || plansLoading}
            >
              Excluir
            </button>
            {actionError && (
              <span style={{ color: "#b91c1c", fontSize: "0.875rem" }}>{actionError}</span>
            )}
          </div>
          {plansLoading ? (
            <p>Carregando...</p>
          ) : plans.length === 0 ? (
            <p>Nenhum plano cadastrado.</p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {plans.map((plan) => {
                const priceLabel = formatCurrencyDisplay(
                  plan.currency || "BRL",
                  Number(plan.price_cents ?? 0)
                );
                const isSelected = plan.id === selectedPlanId;
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #d1d5db",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{plan.name}</span>
                      <span style={{ fontSize: "0.875rem", color: "#4b5563" }}>{priceLabel}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section style={{ flex: 1 }}>
          {plansLoading ? (
            <p>Carregando dados do plano...</p>
          ) : !selectedPlan ? (
            <p>Selecione um plano para editar.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
                <h2 style={{ marginTop: 0 }}>Básico</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span>Nome</span>
                    <input type="text" value={form.name} onChange={handleNameChange} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span>Preço</span>
                    <input type="text" value={form.priceInput} onChange={handlePriceChange} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span>Moeda</span>
                    <select value={form.currency} onChange={handleCurrencyChange}>
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={form.is_active} onChange={handleActiveToggle} />
                    <span>Plano ativo</span>
                  </label>
                </div>
              </div>

              <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
                <h2 style={{ marginTop: 0 }}>Features</h2>
                {groupedFeatures.length === 0 ? (
                  <p>Nenhuma feature configurada.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {groupedFeatures.map((group) => (
                      <details
                        key={group.category}
                        open
                        style={{ border: "1px solid #f3f4f6", borderRadius: "8px", padding: "8px 12px" }}
                      >
                        <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "8px" }}>
                          {formatCategoryLabel(group.category)}
                        </summary>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {group.items.map((feature) => {
                            const showAi =
                              feature.supportsAi ||
                              Boolean(feature.ai_meter_code) ||
                              (feature.ai_monthly_quota !== null && feature.ai_monthly_quota !== "");
                            let control = null;
                            if (feature.type === "boolean") {
                              control = (
                                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(feature.value)}
                                    onChange={(event) =>
                                      handleFeatureBooleanChange(feature.code, event.target.checked)
                                    }
                                  />
                                  <span>{feature.label}</span>
                                </label>
                              );
                            } else if (feature.type === "number") {
                              control = (
                                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span>{feature.label}</span>
                                  <input
                                    type="text"
                                    value={feature.value}
                                    onChange={(event) =>
                                      handleFeatureNumberChange(feature.code, event.target.value)
                                    }
                                    placeholder="Ex.: 10"
                                  />
                                </label>
                              );
                            } else if (feature.type === "enum") {
                              control = (
                                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span>{feature.label}</span>
                                  <select
                                    value={feature.value}
                                    onChange={(event) =>
                                      handleFeatureTextChange(feature.code, event.target.value)
                                    }
                                  >
                                    {feature.options.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              );
                            } else {
                              control = (
                                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span>{feature.label}</span>
                                  <input
                                    type="text"
                                    value={feature.value}
                                    onChange={(event) =>
                                      handleFeatureTextChange(feature.code, event.target.value)
                                    }
                                  />
                                </label>
                              );
                            }

                            return (
                              <div key={feature.code} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {control}
                                {showAi && (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: "12px",
                                    }}
                                  >
                                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                      <span>Medidor de IA</span>
                                      <select
                                        value={feature.ai_meter_code}
                                        onChange={(event) =>
                                          handleFeatureAiMeterChange(feature.code, event.target.value)
                                        }
                                      >
                                        {AI_METER_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                      <span>Cota mensal</span>
                                      <input
                                        type="text"
                                        value={feature.ai_monthly_quota}
                                        onChange={(event) =>
                                          handleFeatureAiQuotaChange(feature.code, event.target.value)
                                        }
                                        placeholder="Ex.: 50000"
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving || plansLoading}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                {saveSuccess && <span style={{ color: "#059669" }}>Alterações salvas</span>}
                {saveError && <span style={{ color: "#b91c1c" }}>{saveError}</span>}
              </div>
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div
          role="presentation"
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 50,
          }}
        >
          <div
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h2 style={{ margin: 0 }}>Novo plano</h2>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span>Nome</span>
              <input type="text" value={modalForm.name} onChange={handleModalNameChange} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span>Preço</span>
              <input type="text" value={modalForm.priceInput} onChange={handleModalPriceChange} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span>Moeda</span>
              <select value={modalForm.currency} onChange={handleModalCurrencyChange}>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={modalForm.is_active}
                onChange={handleModalActiveToggle}
              />
              <span>Plano ativo</span>
            </label>
            {modalError && <span style={{ color: "#b91c1c" }}>{modalError}</span>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button type="button" onClick={closeModal} disabled={modalSaving}>
                Cancelar
              </button>
              <button type="button" onClick={handleCreatePlanAction} disabled={modalSaving}>
                {modalSaving ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
