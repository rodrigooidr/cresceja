import React, { useEffect, useState } from "react";
import api from "../../api/api";

export default function SubscriptionStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Prefer /api/subscription/status if seu backend usa esse caminho
      const res = await api.get("/subscription/status");
      setData(res.data);
    } catch (e1) {
      try {
        // Alternativa comum
        const res = await api.get("/billing/status");
        setData(res.data);
      } catch (e2) {
        setError("Não foi possível obter o status da assinatura. Verifique se o backend expõe /subscription/status ou /billing/status.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6">Carregando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const status = data?.status || "desconhecido";
  const plan = data?.plan || data?.plan_id || "-";
  const start = data?.start_date ? new Date(data.start_date).toLocaleDateString() : "-";
  const end = data?.end_date ? new Date(data.end_date).toLocaleDateString() : "-";
  const next = data?.next_renewal ? new Date(data.next_renewal).toLocaleDateString() : "-";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Minha Assinatura</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow p-4 space-y-2">
          <div><span className="text-gray-500">Plano:</span> <strong>{plan}</strong></div>
          <div><span className="text-gray-500">Status:</span> <strong className={status === "active" ? "text-emerald-600" : "text-gray-800"}>{status}</strong></div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Início:</span> <div>{start}</div></div>
            <div><span className="text-gray-500">Fim:</span> <div>{end}</div></div>
            <div><span className="text-gray-500">Próxima renovação:</span> <div>{next}</div></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="font-medium">Ações</h2>
          <div className="flex flex-wrap gap-2">
            <a className="px-3 py-2 rounded-xl bg-blue-600 text-white" href="/checkout">Alterar plano / Renovar</a>
            <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={load}>Atualizar</button>
          </div>
          <p className="text-xs text-gray-500">Após confirmação do pagamento, seu acesso é renovado e as cotas são resetadas automaticamente (ajuste no backend via webhook).</p>
        </div>
      </div>
    </div>
  );
}
