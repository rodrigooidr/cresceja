import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';

function Field({ def, value, onChange }) {
  const common = { className: 'border p-1 w-full', disabled: false };
  if (def.type === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        {...common}
      />
    );
  }
  if (def.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
      />
    );
  }
  if (def.type === 'enum') {
    const opts = Array.isArray(def.enum_options) ? def.enum_options : [];
    return (
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="border p-1 w-full"
      >
        <option value=""></option>
        {opts.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      {...common}
    />
  );
}

export default function PlansAdmin() {
  const [data, setData] = useState({ plans: [], feature_defs: [], plan_features: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await inboxApi.get('/admin/plans');
      const defs = (data?.feature_defs || []).map(d => ({
        ...d,
        enum_options: Array.isArray(d.enum_options) ? d.enum_options : [],
        enum_text: Array.isArray(d.enum_options) ? d.enum_options.join(',') : ''
      }));
      setData({ plans: data.plans || [], feature_defs: defs, plan_features: data.plan_features || [] });
    } catch (e) {
      console.error('plans_admin_load', e);
      setData({ plans: [], feature_defs: [], plan_features: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveFeature = async (planId, featureCode, value) => {
    setData(prev => {
      const list = prev.plan_features.filter(pf => !(pf.plan_id === planId && pf.feature_code === featureCode));
      list.push({ plan_id: planId, feature_code: featureCode, value });
      return { ...prev, plan_features: list };
    });
    try {
      await inboxApi.put(`/admin/plans/${planId}/features/${featureCode}`, { value });
    } catch (e) {
      console.error('save_feature', e);
    }
  };

  const saveDef = async (def) => {
    const body = {
      code: def.code,
      label: def.label,
      type: def.type,
      unit: def.unit,
      enum_options: def.enum_text ? def.enum_text.split(',').map(s => s.trim()).filter(Boolean) : null,
      description: def.description,
      category: def.category,
      sort_order: def.sort_order,
      is_public: def.is_public,
      show_as_tick: def.show_as_tick,
    };
    try {
      await inboxApi.post('/admin/feature-defs', body);
      await load();
    } catch (e) {
      console.error('save_def', e);
    }
  };

  if (loading) return <div className="p-4">Carregando…</div>;

  const getValue = (planId, code) => {
    const pf = data.plan_features.find(p => p.plan_id === planId && p.feature_code === code);
    return pf ? pf.value : null;
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Planos & Recursos</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Recurso</th>
              {data.plans.map(p => (
                <th key={p.id} className="p-2 text-center">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.feature_defs.map(def => (
              <tr key={def.code} className="border-t">
                <td className="p-2 font-medium">{def.label}</td>
                {data.plans.map(p => (
                  <td key={p.id} className="p-2 text-center">
                    <Field
                      def={def}
                      value={getValue(p.id, def.code)}
                      onChange={v => saveFeature(p.id, def.code, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Definições de Recursos</h2>
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2">Código</th>
              <th className="p-2">Label</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Unidade</th>
              <th className="p-2">Enum options</th>
              <th className="p-2">Público</th>
              <th className="p-2">Tick?</th>
              <th className="p-2">Salvar</th>
            </tr>
          </thead>
          <tbody>
            {data.feature_defs.map(def => (
              <tr key={def.code} className="border-t">
                <td className="p-2">{def.code}</td>
                <td className="p-2"><input className="border p-1" value={def.label || ''} onChange={e => setData(prev => ({ ...prev, feature_defs: prev.feature_defs.map(d => d.code === def.code ? { ...d, label: e.target.value } : d) }))} /></td>
                <td className="p-2">
                  <select className="border p-1" value={def.type} onChange={e => setData(prev => ({ ...prev, feature_defs: prev.feature_defs.map(d => d.code === def.code ? { ...d, type: e.target.value } : d) }))}>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="enum">enum</option>
                    <option value="string">string</option>
                  </select>
                </td>
                <td className="p-2"><input className="border p-1" value={def.unit || ''} onChange={e => setData(prev => ({ ...prev, feature_defs: prev.feature_defs.map(d => d.code === def.code ? { ...d, unit: e.target.value } : d) }))} /></td>
                <td className="p-2"><input className="border p-1" value={def.enum_text || ''} onChange={e => setData(prev => ({ ...prev, feature_defs: prev.feature_defs.map(d => d.code === def.code ? { ...d, enum_text: e.target.value } : d) }))} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={def.is_public} onChange={e => setData(prev => ({ ...prev, feature_defs: prev.feature_defs.map(d => d.code === def.code ? { ...d, is_public: e.target.checked } : d) }))} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={def.show_as_tick} onChange={e => setData(prev => ({ ...prev, feature_defs: prev.feature_defs.map(d => d.code === def.code ? { ...d, show_as_tick: e.target.checked } : d) }))} /></td>
                <td className="p-2 text-center"><button className="btn" onClick={() => saveDef(def)}>Salvar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
