// src/components/PricingTable.jsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { usePricing } from "../contexts/PricingContext";
import { useTrial } from "../contexts/TrialContext";

export default function PricingTable() {
  const { plans, loading, error, refresh } = usePricing();
  const { trialDays } = useTrial();

  // 🔄 Recarrega quando o Admin emitir o evento
  useEffect(() => {
    const handler = () => {
      if (typeof refresh === "function") refresh();
    };
    window.addEventListener("plans-updated", handler);
    return () => window.removeEventListener("plans-updated", handler);
  }, [refresh]);

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-6 border rounded-2xl animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3" />
            <div className="h-8 bg-gray-200 rounded w-1/2 mt-3" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mt-3" />
            <div className="h-9 bg-gray-200 rounded w-1/2 mt-6" />
          </div>
        ))}
      </div>
    );
  }

  const list = Array.isArray(plans) ? plans : [];

  const fmtBRL = (n) =>
    typeof n === "number"
      ? n.toLocaleString("pt-BR", { minimumFractionDigits: 0 })
      : n;

  if (!list.length) {
    return (
      <div className="p-6 border rounded-2xl">
        <div className="font-semibold">Planos temporariamente indisponíveis.</div>
        {error ? <div className="text-sm text-amber-600 mt-2">{String(error)}</div> : null}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {list.map((p) => {
        const isFree =
          p.id === "free" ||
          p.is_free === true ||
          (p.name || "").toLowerCase().includes("free") ||
          p.monthlyPrice === 0;

        const price =
          p.currency === "BRL"
            ? `R$ ${fmtBRL(p.monthlyPrice)}`
            : `${p.monthlyPrice} ${p.currency || ""}`;

        return (
          <div key={p.id || p.name} className="p-6 border rounded-2xl">
            <div className="font-bold text-lg">{p.name}</div>
            <div className="text-2xl font-black mt-2">
              {price}/mês
            </div>

            {isFree ? (
              <div className="text-xs text-blue-600 font-medium mt-1">
                Período de teste: {trialDays} dia{trialDays === 1 ? "" : "s"}
              </div>
            ) : null}

            <ul className="text-sm text-gray-600 mt-3 space-y-1">
              {p.modules?.omnichannel?.enabled && (
                <li>
                  Omnichannel
                  {Number(p.modules?.omnichannel?.chat_sessions) > 0 &&
                    ` — até ${p.modules.omnichannel.chat_sessions} chats/mês`}
                </li>
              )}
              {p.modules?.crm?.enabled && (
                <li>
                  CRM
                  {Number(p.modules?.crm?.opportunities) > 0 &&
                    ` — até ${p.modules.crm.opportunities} oportunidades/mês`}
                </li>
              )}
              {p.modules?.marketing?.enabled && (
                <li>
                  Marketing
                  {Number(p.modules?.marketing?.posts_per_month) > 0 &&
                    ` — até ${p.modules.marketing.posts_per_month} posts/mês`}
                </li>
              )}
              {p.modules?.approvals?.enabled && <li>Aprovação</li>}
              {p.modules?.ai_credits?.enabled && (
                <li>
                  Créditos de IA
                  {Number(p.modules?.ai_credits?.credits) > 0 &&
                    ` — ${p.modules.ai_credits.credits}/mês`}
                </li>
              )}
              {p.modules?.governance?.enabled && <li>Governança</li>}
            </ul>

            {isFree ? (
              <Link
                to="/register"
                className="mt-4 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Começar agora — {trialDays} dia{trialDays === 1 ? "" : "s"} grátis
              </Link>
            ) : (
              <Link
                to={`/checkout?plan=${encodeURIComponent(p.id || "")}`}
                className="mt-4 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Assinar agora
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
