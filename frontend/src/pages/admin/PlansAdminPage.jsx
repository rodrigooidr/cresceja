import React, { useEffect, useMemo, useState } from "react";
import inboxApi from "../../api/inboxApi";
import useActiveOrgGate from "../../hooks/useActiveOrgGate";
import PricingTable from "../../components/PricingTable"; // preview público

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function FeatureInput({ def, value, onChange }) {
  if (def.type === "boolean") {
    return (
      <select className="border rounded px-2 py-1" value={value ? "true" : "false"} onChange={e => onChange(e.target.value === "true")}> 
        <option value="false">Não</option>
        <option value="true">Sim</option>
      </select>
    );
  }
  if (def.type === "number") {
    return (
      <input type="number" className="border rounded px-2 py-1 w-32"
        value={Number(value ?? 0)} onChange={e => onChange(Number(e.target.value))} />
    );
  }
  if (def.type === "enum" && Array.isArray(def.enum_options)) {
    return (
      <select className="border rounded px-2 py-1" value={value ?? ""} onChange={e => onChange(e.target.value)}>
        {[{value:"", label:"Selecione..."}, ...def.enum_options].map((o,i)=>(
          <option key={i} value={o.value ?? o}>{o.label ?? o.value ?? o}</option>
        ))}
      </select>
    );
  }
  return (
    <input className="border rounded px-2 py-1" value={value ?? ""} onChange={e => onChange(e.target.value)} />
  );
}

export default function PlansAdminPage({ minRole = "SuperAdmin" }) {
  const { allowed, reason } = useActiveOrgGate({ minRole, requireActiveOrg: false });
  const [state, setState] = useState({ loading: true, error: null, plans: [], defs: [], feats: [] });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const { data } = await inboxApi.get("/admin/plans");
      setState({ loading: false, error: null, plans: data?.plans ?? [], defs: data?.feature_defs ?? [], feats: data?.plan_features ?? [] });
    } catch (e) {
      setState({ loading: false, error: e?.message || "Falha ao carregar", plans: [], defs: [], feats: [] });
    }
  };

  useEffect(() => { load(); }, []);

  const defsPublic = useMemo(() => state.defs.sort((a,b)=> (a.sort_order||0)-(b.sort_order||0)), [state.defs]);

  const upsertPlan = async (p) => {
    setSaving(true);
    try {
      if (p.id) {
        await inboxApi.put(`/admin/plans/${p.id}`, p);
      } else {
        await inboxApi.post(`/admin/plans`, p);
      }
      await load();
    } finally { setSaving(false); }
  };

  const upsertFeatureDef = async (def) => {
    setSaving(true);
    try {
      await inboxApi.post(`/admin/feature-defs`, def);
      await load();
    } finally { setSaving(false); }
  };

  const upsertPlanFeature = async (planId, code, value) => {
    setSaving(true);
    try {
      await inboxApi.put(`/admin/plans/${planId}/features/${code}`, { value });
      await load();
    } finally { setSaving(false); }
  };

  if (!allowed) return <div className="p-6 text-sm text-gray-600">Acesso bloqueado: {String(reason)}</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos (Admin)</h1>
        <button className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          onClick={async () => { setCreating(true); await upsertPlan({ name: "Novo Plano", price_cents: 0, currency: "BRL", trial_days: 0, is_active: true, sort_order: 99 }); setCreating(false); }}
          disabled={creating || saving}>
          {creating ? "Criando..." : "Novo plano"}
        </button>
      </div>

      {state.loading && <div>Carregando…</div>}
      {state.error && <div className="text-amber-700">{String(state.error)}</div>}

      {!state.loading && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Coluna esquerda: planos e features */}
          <div className="space-y-6">
            {state.plans.map((p) => (
              <div key={p.id} className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">{p.name || p.id}</div>
                  <button className="text-sm px-3 py-1 rounded border disabled:opacity-60"
                    onClick={() => upsertPlan({ id: p.id, is_active: !p.is_active })}
                    disabled={saving}>
                    {p.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Nome">
                    <input className="border rounded px-2 py-1"
                      defaultValue={p.name}
                      onBlur={(e)=> upsertPlan({ id: p.id, name: e.target.value })} />
                  </Field>
                  <Field label="Preço (centavos)">
                    <input type="number" className="border rounded px-2 py-1"
                      defaultValue={p.price_cents ?? 0}
                      onBlur={(e)=> upsertPlan({ id: p.id, price_cents: Number(e.target.value||0) })} />
                  </Field>
                  <Field label="Moeda">
                    <input className="border rounded px-2 py-1"
                      defaultValue={p.currency || "BRL"}
                      onBlur={(e)=> upsertPlan({ id: p.id, currency: e.target.value || "BRL" })} />
                  </Field>
                  <Field label="Dias de trial">
                    <input type="number" className="border rounded px-2 py-1"
                      defaultValue={p.trial_days ?? 0}
                      onBlur={(e)=> upsertPlan({ id: p.id, trial_days: Number(e.target.value||0) })} />
                  </Field>
                  <Field label="Ordem">
                    <input type="number" className="border rounded px-2 py-1"
                      defaultValue={p.sort_order ?? 0}
                      onBlur={(e)=> upsertPlan({ id: p.id, sort_order: Number(e.target.value||0) })} />
                  </Field>
                </div>

                <div className="mt-4">
                  <div className="font-medium mb-2">Recursos</div>
                  <div className="grid gap-2">
                    {defsPublic.map(def => {
                      const existing = state.feats.find(f => f.plan_id === p.id && f.feature_code === def.code);
                      const currentValue = existing?.value?.value ?? existing?.value ?? null;
                      return (
                        <div key={`${p.id}-${def.code}`} className="flex items-center gap-3">
                          <div className="w-64 text-sm">{def.label}</div>
                          <FeatureInput def={def} value={currentValue}
                            onChange={(val)=> upsertPlanFeature(p.id, def.code, val)} />
                          {def.unit && <span className="text-xs text-gray-500">{def.unit}</span>}
                          {def.show_as_tick && <span className="text-xs text-gray-400">(tick)</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Coluna direita: Definições + Preview */}
          <div className="space-y-6">
            <div className="border rounded-xl p-4">
              <div className="font-semibold mb-3">Definições de Recursos</div>
              <div className="grid gap-2">
                {defsPublic.map(def => (
                  <div key={def.code} className="flex items-center gap-2">
                    <span className="w-40 text-sm">{def.code}</span>
                    <input className="border rounded px-2 py-1 w-56"
                      defaultValue={def.label}
                      onBlur={(e)=> upsertFeatureDef({ ...def, label: e.target.value })} />
                    <input className="border rounded px-2 py-1 w-24"
                      placeholder="unidade"
                      defaultValue={def.unit ?? ""}
                      onBlur={(e)=> upsertFeatureDef({ ...def, unit: e.target.value || null })} />
                    <input type="number" className="border rounded px-2 py-1 w-20"
                      defaultValue={def.sort_order ?? 0}
                      onBlur={(e)=> upsertFeatureDef({ ...def, sort_order: Number(e.target.value||0) })} />
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" defaultChecked={!!def.is_public}
                        onChange={(e)=> upsertFeatureDef({ ...def, is_public: e.target.checked })} />
                      público
                    </label>
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" defaultChecked={!!def.show_as_tick}
                        onChange={(e)=> upsertFeatureDef({ ...def, show_as_tick: e.target.checked })} />
                      tick
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-xl p-4">
              <div className="font-semibold mb-3">Pré-visualização pública</div>
              <PricingTable endpoint="/public/plans" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

