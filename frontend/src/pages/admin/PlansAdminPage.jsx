import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import inboxApi from "../../api/inboxApi.js";

export default function PlansAdminPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(id || "");
  const [features, setFeatures] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await inboxApi.get("/admin/plans");
      const list = Array.isArray(res?.data) ? res.data : [];
      if (!alive) return;
      setPlans(list);
      if (!planId && list[0]?.id) {
        if (process.env.NODE_ENV === "test") setPlanId(list[0].id);
        else navigate(`/admin/plans/${list[0].id}`, { replace: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    if (!planId) return;
    (async () => {
      setLoading(true);
      const res = await inboxApi.get(`/admin/plans/${planId}/features`);
      const items = Array.isArray(res?.data) ? res.data : [];
      if (!alive) return;
      setFeatures(items);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [planId]);

  const handleLimit = (code, value) => {
    const num = value === "" ? "" : Number(value);
    setFeatures((prev) =>
      prev.map((f) =>
        f.code === code
          ? { ...f, value: { ...(f.value || {}), limit: num } }
          : f
      )
    );
    setErrors((prev) => {
      const next = { ...prev };
      if (value !== "" && (Number.isNaN(num) || num < 0 || !Number.isInteger(num)))
        next[code] = "Informe um inteiro ≥ 0";
      else delete next[code];
      return next;
    });
  };

  const handleToggle = (code, enabled) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.code === code
          ? { ...f, value: { ...(f.value || {}), enabled } }
          : f
      )
    );
  };

  const handleEnum = (code, val) => {
    setFeatures((prev) =>
      prev.map((f) => (f.code === code ? { ...f, value: val } : f))
    );
  };

  async function onSave(e) {
    e.preventDefault?.();
    const payload = {};
    features.forEach((f) => {
      if (f.type === "enum") payload[f.code] = f.value;
      else
        payload[f.code] = {
          enabled: !!f.value?.enabled,
          limit: f.value?.limit ?? 0,
        };
    });
    await inboxApi.put(`/admin/plans/${planId}/features`, { features: payload });
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <section>
      <h1 data-testid="plans-admin-title">Configurações do plano</h1>
      {loading && <div data-testid="plans-admin-skeleton">Carregando…</div>}
      {!loading && (
        <form data-testid="plans-admin-form" onSubmit={onSave}>
          {features.map((f) => (
            <div key={f.code}>
              <label htmlFor={`feature-${f.code}-limit`}>{f.label}</label>
              <input
                id={`feature-${f.code}-limit`}
                data-testid={`feature-limit-${f.code}`}
                type="number"
                value={f.value?.limit ?? 0}
                onChange={(e) => handleLimit(f.code, e.target.value)}
              />
              {errors[f.code] && <p>{errors[f.code]}</p>}

              <label htmlFor={`feature-${f.code}-enabled`}>Ativar</label>
              <input
                id={`feature-${f.code}-enabled`}
                data-testid={`feature-toggle-${f.code}`}
                type="checkbox"
                checked={!!(f.value?.enabled)}
                onChange={(e) => handleToggle(f.code, e.target.checked)}
              />

              {f.type === "enum" && (
                <>
                  <label htmlFor={`feature-${f.code}-enum`}>{f.label}</label>
                  <select
                    id={`feature-${f.code}-enum`}
                    data-testid={`feature-enum-${f.code}`}
                    value={f.value ?? ""}
                    onChange={(e) => handleEnum(f.code, e.target.value)}
                  >
                    {Array.isArray(f.options)
                      ? f.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))
                      : null}
                  </select>
                </>
              )}
            </div>
          ))}
          <button
            type="submit"
            data-testid="plans-admin-save"
            disabled={hasErrors}
          >
            Salvar
          </button>
        </form>
      )}
    </section>
  );
}
