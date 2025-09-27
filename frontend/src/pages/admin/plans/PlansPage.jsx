import { useEffect, useState } from "react";
import { adminListPlans, adminGetPlanFeatures } from "@/api/inboxApi";

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await adminListPlans();
        setPlans(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSelect = async (plan) => {
    setSelected(plan);
    setFeatures([]);
    if (!plan?.id) return;
    const feat = await adminGetPlanFeatures(plan.id);
    setFeatures(Array.isArray(feat) ? feat : []);
  };

  if (loading) return <div>Carregando…</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Planos</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <ul className="divide-y border rounded">
            {plans.map((p) => (
              <li
                key={p.id}
                className={`p-2 cursor-pointer ${selected?.id === p.id ? "bg-gray-100" : ""}`}
                onClick={() => onSelect(p)}
                data-testid={`plan-item-${p.id}`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-500">
                  {p.currency || "BRL"} {p.monthly_price ?? 0}
                </div>
              </li>
            ))}
            {plans.length === 0 && (
              <li className="p-2 text-gray-500">Nenhum plano encontrado.</li>
            )}
          </ul>
        </div>

        <div className="col-span-2">
          {!selected && <div className="text-gray-600">Selecione um plano.</div>}
          {selected && (
            <>
              <h2 className="text-lg font-semibold mb-2">{selected.name}</h2>
              <div className="text-sm mb-4">
                <span className="mr-3">Ativo: {String(selected.is_active)}</span>
                <span className="mr-3">Publicado: {String(selected.is_published)}</span>
                <span className="mr-3">Grátis: {String(selected.is_free)}</span>
                <span>Trial (dias): {selected.trial_days}</span>
              </div>

              <h3 className="font-medium mt-4 mb-2">Funcionalidades</h3>
              <ul className="border rounded divide-y">
                {features.map((f) => (
                  <li key={f.code ?? f.feature_code ?? "feature"} className="p-2">
                    <div className="font-medium">{f.code ?? f.feature_code}</div>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1">
                      {JSON.stringify(f.value, null, 2)}
                    </pre>
                  </li>
                ))}
                {features.length === 0 && (
                  <li className="p-2 text-gray-500">Nenhuma funcionalidade vinculada.</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
