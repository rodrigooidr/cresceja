import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function PaymentError() {
  const navigate = useNavigate();
  const loc = useLocation();
  const search = new URLSearchParams(loc.search);
  const plan = search.get("plan");

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-semibold">Pagamento não concluído</h1>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
        A transação foi cancelada ou não pôde ser processada.
      </div>
      <div className="flex gap-2 justify-center">
        <a href={plan ? `/checkout?plan=${plan}` : "/checkout"} className="px-4 py-2 rounded-xl bg-blue-600 text-white">Tentar novamente</a>
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-gray-100">Voltar</button>
      </div>
    </div>
  );
}
