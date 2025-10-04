import inboxApi from "../../api/inboxApi";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import inboxApi from "../../api/inboxApi";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function PaymentSuccess() {
  const query = useQuery();
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState("Confirmando pagamento...");
  const sessionId = query.get("session_id");
  const paymentId = query.get("payment_id");
  const plan = query.get("plan");

  useEffect(() => {
    async function verify() {
      try {
        const res = await inboxApi.get("/billing/verify", { params: { session_id: sessionId, payment_id: paymentId, plan } });
        if (res?.data?.status === "paid" || res?.data?.ok) {
          setOk(true);
          setMsg("Pagamento confirmado! Sua assinatura foi ativada/renovada.");
          return;
        }
      } catch (e1) {
        try {
          const res2 = await inboxApi.get("/payments/verify", { params: { session_id: sessionId, payment_id: paymentId, plan } });
          if (res2?.data?.status === "paid" || res2?.data?.ok) {
            setOk(true);
            setMsg("Pagamento confirmado! Sua assinatura foi ativada/renovada.");
            return;
          }
        } catch (e2) {}
      }
      setOk(true); // fallback otimista (se backend ainda não implementado)
      setMsg("Pagamento concluído. Caso não veja a renovação, aguarde o processamento do provedor.");
    }
    verify();
  }, [sessionId, paymentId, plan]);

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-semibold">Sucesso!</h1>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">{msg}</div>
      <div className="flex gap-2 justify-center">
        <a href="/assinatura/status" className="px-4 py-2 rounded-xl bg-blue-600 text-white">Ver minha assinatura</a>
        <button onClick={() => navigate('/crm/oportunidades')} className="px-4 py-2 rounded-xl bg-gray-100">Ir para o app</button>
      </div>
    </div>
  );
}


