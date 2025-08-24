import axios from 'axios';
// src/pages/Admin/AdminPlans.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/api";

const DEFAULT_PLAN = () => ({
  id: "",
  name: "",
  monthlyPrice: 0,
  currency: "BRL",
  is_published: false,
  sort_order: 9999,
  // novos campos padrão
  is_free: false,
  trial_days: 14,
  billing_period_months: 1,
  max_users: 1, // 👈 NOVO: usuários incluídos no plano
  modules: {
    omnichannel: { enabled: true, chat_sessions: 200 },
    crm: { enabled: true, opportunities: 500 },
    marketing: { enabled: true, posts_per_month: 20 },
    approvals: { enabled: true },
    ai_credits: { enabled: true, credits: 10000 },
    governance: { enabled: true },
  },
});

// chave estável
const uniq = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

export default function AdminPlans() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await axios.get(`/api/admin/plans`);
      } catch {
        res = await axios.get(`/api/public/plans`);
      }
      const data = res?.data;
      const list = Array.isArray(data?.plans)
        ? data.plans
        : Array.isArray(data)
        ? data
        : [];
      const normalized = list.map((p) => ({
        ...DEFAULT_PLAN(),
        ...p,
        _isNew: false,
        _key: p._key || p.id || uniq(),
      }));
      setItems(normalized);
    } catch (e) {
      console.error("AdminPlans load error", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onField = (key, path, value) => {
    setItems((prev) =>
      prev.map((plan) => {
        if (plan._key !== key) return plan;
        const clone = { ...plan };
        const segs = path.split(".");
        let cur = clone;
        for (let i = 0; i < segs.length - 1; i++) {
          const k = segs[i];
          cur[k] = cur[k] ?? {};
          cur = cur[k];
        }
        cur[segs[segs.length - 1]] = value;
        return clone;
      })
    );
  };

  const savePlan = async (plan) => {
    if (plan._isNew && !plan.id) {
      alert("Defina um ID para o plano (ex.: starter, pro, business).");
      return;
    }
    setSavingId(plan.id || "_new_");
    try {
      const body = {
        id: plan.id,
        name: plan.name,
        monthlyPrice: Number(plan.monthlyPrice ?? 0),
        currency: plan.currency || "BRL",
        modules: plan.modules,
        is_published: !!plan.is_published,
        sort_order: plan.sort_order ?? 9999,
        is_free: !!plan.is_free,
        trial_days: Number(plan.trial_days ?? 14),
        billing_period_months: Number(plan.billing_period_months ?? 1),
        max_users: Number(plan.max_users ?? 1), // 👈 NOVO: enviado para a API
      };

      if (!plan._isNew) {
        await axios.patch(`/api/admin/plans/${plan.id}`, body);
      } else {
        const { data } = await axios.post(`/api/admin/plans`, body);
        const newId = data?.id || body.id;
        setItems((prev) =>
          prev.map((it) =>
            it._key === plan._key ? { ...plan, id: newId, _isNew: false } : it
          )
        );
      }

      // dispara evento se for plano free
      const wasFree = body.id === "free" || body.is_free;
      if (wasFree) {
        window.dispatchEvent(new CustomEvent("trial-updated"));
      }

      // qualquer mudança de plano
      window.dispatchEvent(new CustomEvent("plans-updated"));
      alert("Plano salvo!");
    } catch (e) {
      console.error("savePlan", e);
      alert("Falha ao salvar plano.");
    } finally {
      setSavingId(null);
    }
  };

  const publishPlan = async (plan, value) => {
    if (!plan.id) {
      alert("Defina e salve o ID do plano antes de publicar.");
      return;
    }
    setSavingId(plan.id || "_new_");
    try {
      try {
        await axios.post(`/api/admin/plans/${plan.id}/publish`, {
          is_published: value,
        });
      } catch {
        await axios.patch(`/api/admin/plans/${plan.id}`, { is_published: value });
      }
      setItems((prev) =>
        prev.map((it) =>
          it._key === plan._key ? { ...it, is_published: value } : it
        )
      );
      window.dispatchEvent(new CustomEvent("plans-updated"));
    } catch (e) {
      console.error("publishPlan", e);
      alert("Falha ao publicar plano.");
    } finally {
      setSavingId(null);
    }
  };

  const removePlan = async (plan) => {
    if (plan._isNew) return removePlanLocal(plan);
    if (!window.confirm('Excluir plano permanentemente?')) return;
    try {
      await axios.delete(`/api/admin/plans/${plan.id}`);
      setItems((prev) => prev.filter((p) => p._key !== plan._key));
      window.dispatchEvent(new CustomEvent('plans-updated'));
    } catch (e) {
      console.error('removePlan', e);
      alert('Falha ao remover plano.');
    }
  };

  const addPlan = () => {
    setItems((prev) => [
      { ...DEFAULT_PLAN(), _isNew: true, _key: uniq() },
      ...prev,
    ]);
  };

  const removePlanLocal = (plan) => {
    if (!plan._isNew) {
      alert("Remoção de planos existentes deve ser feita pelo backend.");
      return;
    }
    setItems((prev) => prev.filter((p) => p._key !== plan._key));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin • Planos & Módulos</h1>
        <div className="flex items-center gap-2">
          <button onClick={addPlan} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
            + Novo plano
          </button>
          <button onClick={load} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
            Recarregar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-gray-500">Carregando…</div>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((p) => (
            <div key={p._key} className="border rounded-xl p-4">
              <div className="grid md:grid-cols-12 gap-3">
                {/* Identificação e preço */}
                <div className="md:col-span-3">
                  <label className="text-xs text-gray-500">ID</label>
                  <input
                    value={p.id || ""}
                    disabled={!p._isNew}
                    onChange={(e) => onField(p._key, "id", e.target.value)}
                    placeholder="ex.: starter"
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs text-gray-500">Nome</label>
                  <input
                    value={p.name || ""}
                    onChange={(e) => onField(p._key, "name", e.target.value)}
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Preço mensal</label>
                  <input
                    type="number"
                    min="0"
                    value={p.monthlyPrice ?? 0}
                    onChange={(e) => onField(p._key, "monthlyPrice", Number(e.target.value))}
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Moeda</label>
                  <select
                    value={p.currency || "BRL"}
                    onChange={(e) => onField(p._key, "currency", e.target.value)}
                    className="w-full border rounded-lg px-2 py-2"
                  >
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                {/* NOVO: Usuários incluídos no plano */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Usuários incluídos</label>
                  <input
                    type="number"
                    min="0"
                    value={p.max_users ?? 1}
                    onChange={(e) => onField(p._key, "max_users", Number(e.target.value))}
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                {/* novos controles visuais */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Plano Free?</label>
                  <button
                    onClick={() => onField(p._key, "is_free", !p.is_free)}
                    className={`w-full px-3 py-2 rounded-lg ${
                      p.is_free ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {p.is_free ? "Sim" : "Não"}
                  </button>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Dias de teste (Free)</label>
                  <input
                    type="number"
                    min="0"
                    value={p.trial_days ?? 14}
                    onChange={(e) => onField(p._key, "trial_days", Number(e.target.value))}
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Ciclo (meses) pagos</label>
                  <input
                    type="number"
                    min="0"
                    value={p.billing_period_months ?? 1}
                    onChange={(e) =>
                      onField(p._key, "billing_period_months", Number(e.target.value))
                    }
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 block">Publicado</label>
                  <button
                    onClick={() => publishPlan(p, !p.is_published)}
                    className={`w-full px-3 py-2 rounded-lg ${
                      p.is_published ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {p.is_published ? "Publicado" : "Rascunho"}
                  </button>
                </div>
              </div>

              {/* Módulos e limites */}
              <div className="grid md:grid-cols-12 gap-3 mt-4">
                {/* Omnichannel */}
                <div className="md:col-span-4 border rounded-lg p-3">
                  <div className="font-semibold">Omnichannel</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!p.modules?.omnichannel?.enabled}
                      onChange={(e) =>
                        onField(p._key, "modules.omnichannel.enabled", e.target.checked)
                      }
                    />
                    Habilitado
                  </label>
                  <div className="text-xs text-gray-500 mt-2">Sessões de chat/mês</div>
                  <input
                    type="number"
                    min="0"
                    value={p.modules?.omnichannel?.chat_sessions ?? 0}
                    onChange={(e) =>
                      onField(p._key, "modules.omnichannel.chat_sessions", Number(e.target.value))
                    }
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                {/* CRM */}
                <div className="md:col-span-4 border rounded-lg p-3">
                  <div className="font-semibold">CRM</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!p.modules?.crm?.enabled}
                      onChange={(e) => onField(p._key, "modules.crm.enabled", e.target.checked)}
                    />
                    Habilitado
                  </label>
                  <div className="text-xs text-gray-500 mt-2">Oportunidades/mês</div>
                  <input
                    type="number"
                    min="0"
                    value={p.modules?.crm?.opportunities ?? 0}
                    onChange={(e) =>
                      onField(p._key, "modules.crm.opportunities", Number(e.target.value))
                    }
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                {/* Marketing */}
                <div className="md:col-span-4 border rounded-lg p-3">
                  <div className="font-semibold">Marketing</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!p.modules?.marketing?.enabled}
                      onChange={(e) =>
                        onField(p._key, "modules.marketing.enabled", e.target.checked)
                      }
                    />
                    Habilitado
                  </label>
                  <div className="text-xs text-gray-500 mt-2">Posts/mês</div>
                  <input
                    type="number"
                    min="0"
                    value={p.modules?.marketing?.posts_per_month ?? 0}
                    onChange={(e) =>
                      onField(p._key, "modules.marketing.posts_per_month", Number(e.target.value))
                    }
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                {/* Aprovação */}
                <div className="md:col-span-4 border rounded-lg p-3">
                  <div className="font-semibold">Aprovação</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!p.modules?.approvals?.enabled}
                      onChange={(e) =>
                        onField(p._key, "modules.approvals.enabled", e.target.checked)
                      }
                    />
                    Habilitado
                  </label>
                </div>

                {/* Créditos de IA */}
                <div className="md:col-span-4 border rounded-lg p-3">
                  <div className="font-semibold">Créditos de IA</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!p.modules?.ai_credits?.enabled}
                      onChange={(e) =>
                        onField(p._key, "modules.ai_credits.enabled", e.target.checked)
                      }
                    />
                    Habilitado
                  </label>
                  <div className="text-xs text-gray-500 mt-2">Créditos/mês</div>
                  <input
                    type="number"
                    min="0"
                    value={p.modules?.ai_credits?.credits ?? 0}
                    onChange={(e) =>
                      onField(p._key, "modules.ai_credits.credits", Number(e.target.value))
                    }
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                {/* Governança */}
                <div className="md:col-span-4 border rounded-lg p-3">
                  <div className="font-semibold">Governança</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!p.modules?.governance?.enabled}
                      onChange={(e) =>
                        onField(p._key, "modules.governance.enabled", e.target.checked)
                      }
                    />
                    Habilitado
                  </label>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => savePlan(p)}
                  disabled={savingId === (p.id || "_new_")}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingId === (p.id || "_new_") ? "Salvando…" : "Salvar"}
                </button>
                {p._isNew ? (
                  <button
                    onClick={() => removePlanLocal(p)}
                    className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                  >
                    Remover rascunho
                  </button>
                ) : (
                  <button
                    onClick={() => removePlan(p)}
                    className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}

          {!items.length && (
            <div className="text-sm text-gray-500">
              Nenhum plano. Clique em “+ Novo plano” para criar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


