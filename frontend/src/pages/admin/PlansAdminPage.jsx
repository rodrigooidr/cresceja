import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';
import useToastFallback from '../../hooks/useToastFallback.js';

export default function PlansAdminPage() {
  const toast = useToastFallback();
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const [features, setFeatures] = useState([]);
  const [orig, setOrig] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    inboxApi
      .get('/admin/plans')
      .then(({ data }) => setPlans(data?.plans || data || []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (!planId) return;
    inboxApi
      .get(`/admin/plans/${planId}/features`)
      .then(({ data }) => {
        setFeatures(data || []);
        setOrig(JSON.parse(JSON.stringify(data || [])));
        setErrors({});
      })
      .catch(() => {
        toast({ title: 'Falha ao carregar recursos do plano' });
        setFeatures([]);
      });
  }, [planId, toast]);

  const hasChanges = JSON.stringify(features) !== JSON.stringify(orig);

  const handleBool = (code, enabled) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.code === code ? { ...f, value: { ...f.value, enabled } } : f
      )
    );
  };

  const handleLimit = (code, v) => {
    const val = v === '' ? null : Number(v);
    setFeatures((prev) =>
      prev.map((f) =>
        f.code === code ? { ...f, value: { ...f.value, limit: val } } : f
      )
    );
    setErrors((e) => {
      const next = { ...e };
      if (v !== '' && (Number.isNaN(val) || val < 0 || !Number.isInteger(val))) {
        next[code] = 'Informe um inteiro ≥ 0';
      } else {
        delete next[code];
      }
      return next;
    });
  };

  const handleSave = async () => {
    const payload = {};
    for (const f of features) {
      if (f.type === 'number') {
        payload[f.code] = {
          enabled: f.value.limit !== 0,
          limit: f.value.limit,
        };
      } else {
        payload[f.code] = {
          enabled: !!f.value.enabled,
          limit: f.value.limit ?? 1,
        };
      }
    }
    try {
      await inboxApi.put(`/admin/plans/${planId}/features`, { features: payload });
      toast({ title: 'Salvo com sucesso' });
      setOrig(JSON.parse(JSON.stringify(features)));
    } catch (err) {
      if (err?.response?.status === 403) {
        toast({ title: 'Você não tem permissão' });
      } else if (err?.response?.status === 422) {
        const det = err.response.data?.details || [];
        const next = {};
        det.forEach((d) => { next[d.path?.[1]] = d.message; });
        setErrors(next);
      } else {
        toast({ title: 'Erro ao salvar' });
      }
    }
  };

  const handleCancel = () => {
    setFeatures(JSON.parse(JSON.stringify(orig)));
    setErrors({});
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Configurações do plano</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" htmlFor="plan-select">
          Plano
        </label>
        <select
          id="plan-select"
          className="border rounded p-2"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        >
          <option value="">Selecione...</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {planId && (
        <div>
          <div className="mb-2 text-sm text-gray-600">
            0 = desabilita; vazio = ilimitado
          </div>
          <table className="min-w-full border" data-testid="features-table">
            <tbody>
              {features.map((f) => (
                <tr key={f.code} className="border-t">
                  <td className="p-2 align-top">
                    <div className="font-medium">{f.label}</div>
                    {f.category && (
                      <span className="ml-1 text-xs bg-gray-100 px-1 py-0.5 rounded">
                        {f.category}
                      </span>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    {f.type === 'boolean' && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={f.code}
                          checked={!!f.value.enabled}
                          onChange={(e) => handleBool(f.code, e.target.checked)}
                        />
                        Habilitado
                      </label>
                    )}
                    {f.type === 'number' && (
                      <div>
                        <input
                          type="number"
                          name={f.code}
                          aria-label={f.code}
                          value={f.value.limit ?? ''}
                          onChange={(e) => handleLimit(f.code, e.target.value)}
                          className={`border rounded p-1 w-24 ${
                            errors[f.code] ? 'border-red-500' : ''
                          }`}
                        />
                        {errors[f.code] && (
                          <p className="text-red-600 text-xs">{errors[f.code]}</p>
                        )}
                      </div>
                    )}
                    {f.type !== 'boolean' && f.type !== 'number' && (
                      <span>{String(f.value?.enabled ? f.value.limit : '')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              onClick={handleSave}
              disabled={!hasChanges || Object.keys(errors).length > 0}
            >
              Salvar
            </button>
            <button
              className="px-4 py-2 border rounded disabled:opacity-50"
              onClick={handleCancel}
              disabled={!hasChanges}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
