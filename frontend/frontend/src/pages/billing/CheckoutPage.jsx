import inboxApi from "../../api/inboxApi";
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import inboxApi from "../../api/inboxApi";
import { usePricing } from "../../contexts/PricingContext";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function CheckoutPage() {
  const query = useQuery();
  const navigate = useNavigate();
  const planId = query.get("plan") || "starter";
  const { plans } = usePricing();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const plan = (plans || []).find(p => p.id === planId) || (plans || [])[0];
  const amount = plan?.monthlyPrice;

  async function startCheckout() {
    setLoading(true);
    setError(null);
    const payload = {
      plan_id: plan?.id,
      // URLs que o backend deve usar como retorno do provedor de pagamento:
      success_url: `${window.location.origin}/checkout/success?plan=${plan?.id}`,
      cancel_url: `${window.location.origin}/checkout/error?plan=${plan?.id}`,
    };
    try {
      // Tente endpoints mais comuns
      const res = await inboxApi.post("/billing/checkout", payload);
      const url = res?.data?.checkout_url || res?.data?.init_point || res?.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      // Stripe checkout session id, se vier sem url:
      if (res?.data?.session_id) {
        const s = res.data.session_id;
        window.location.href = `${window.location.origin}/checkout/success?session_id=${encodeURIComponent(s)}&plan=${plan?.id}`;
        return;
      }
      setError("Resposta do checkout não trouxe URL. Verifique o backend.");
    } catch (e1) {
      try {
        const res2 = await inboxApi.post("/payments/checkout", payload);
        const url2 = res2?.data?.checkout_url || res2?.data?.init_point || res2?.data?.url;
        if (url2) {
          window.location.href = url2;
          return;
        }
        setError("Resposta do checkout alternativa não trouxe URL.");
      } catch (e2) {
        setError("Falha ao iniciar o checkout. Confirme se /billing/checkout ou /payments/checkout existem.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      {plan ? (
        <div className="bg-white rounded-2xl shadow p-4 space-y-2">
          <div className="text-lg font-medium">Plano: {plan.name}</div>
          <div className="text-2xl font-bold">R${amount}<span className="text-base text-gray-500">/mês</span></div>
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 rounded-xl border">Nenhum plano encontrado. Retorne à página de planos.</div>
      )}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl border">{error}</div>}
      <div className="flex gap-2">
        <button onClick={startCheckout} disabled={loading} className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50">
          {loading ? "Redirecionando..." : "Pagar agora"}
        </button>
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-gray-100">Voltar</button>
      </div>
      <p className="text-xs text-gray-500">O pagamento é processado por provedor seguro (Stripe/Mercado Pago). Você será redirecionado.</p>
    </div>
  );
}


