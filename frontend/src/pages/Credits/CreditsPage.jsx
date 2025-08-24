import axios from 'axios';
// src/pages/Credits/CreditsPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api";
import TrialDaysLabel from "../../components/TrialDaysLabel";

export default function CreditsPage() {
  const [credits, setCredits] = useState(null);
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [cRes, sRes] = await Promise.all([
        axios.get("/ai-credits/status"),
        axios.get("/subscription/status"),
      ]);
      setCredits(cRes?.data ?? null);
      setSub(sRes?.data ?? null);
    } catch (e) {
      console.error("CreditsPage fetch error", e);
      setErr("Não foi possível carregar os dados agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const startTrial = async () => {
    try {
      await axios.post("/subscription/start-trial");
      await fetchAll();
    } catch (e) {
      console.error("startTrial", e);
      alert("Não foi possível iniciar o teste agora.");
    }
  };

  const planLabel =
    sub?.planName || sub?.plan || sub?.plan_id || (sub?.plan?.id || "");

  // dias restantes — cobre vários formatos possíveis
  const daysLeft =
    typeof sub?.daysRemaining === "number"
      ? sub.daysRemaining
      : typeof sub?.trial_days_left === "number"
      ? sub.trial_days_left
      : null;

  const isNoSub =
    !sub ||
    sub.status === "no_subscription" ||
    sub.status === "expired" ||
    sub.active === false;

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Créditos de IA</h1>
        <div className="mt-4 text-sm text-gray-500">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Créditos de IA</h1>
        <button
          onClick={fetchAll}
          className="px-3 py-2 rounded-lg border hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      {err && (
        <div className="mt-4 p-3 rounded bg-amber-50 text-amber-800 text-sm">
          {err}
        </div>
      )}

      {/* Bloco de créditos */}
      <section className="mt-6 border rounded-xl p-4">
        <h2 className="text-lg font-semibold">Seu saldo</h2>

        {credits ? (
          <div className="mt-2 grid md:grid-cols-3 gap-4 text-sm">
            {/* Tenta exibir campos comuns; cai para JSON se estrutura for diferente */}
            {"remaining" in credits || "limit" in credits || "used" in credits ? (
              <>
                {"limit" in credits && (
                  <div className="p-3 rounded bg-gray-50 border">
                    <div className="text-xs text-gray-500">Limite mensal</div>
                    <div className="text-lg font-semibold">{credits.limit}</div>
                  </div>
                )}
                {"used" in credits && (
                  <div className="p-3 rounded bg-gray-50 border">
                    <div className="text-xs text-gray-500">Consumido</div>
                    <div className="text-lg font-semibold">{credits.used}</div>
                  </div>
                )}
                {"remaining" in credits && (
                  <div className="p-3 rounded bg-gray-50 border">
                    <div className="text-xs text-gray-500">Restante</div>
                    <div className="text-lg font-semibold">
                      {credits.remaining}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="md:col-span-3">
                <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
                  {JSON.stringify(credits, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">
            Sem informações de créditos.
          </div>
        )}
      </section>

      {/* Bloco de assinatura */}
      <section className="mt-6 border rounded-xl p-4">
        <h2 className="text-lg font-semibold">Assinatura</h2>

        {isNoSub ? (
          <div className="mt-3">
            <p className="text-sm text-gray-700">
              Você ainda não possui uma assinatura ativa.
            </p>

            <div className="mt-3 flex items-center gap-2">
              {/* CTA 1: começar teste (caso backend suporte) */}
              <button
                onClick={startTrial}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Iniciar teste agora
              </button>

              {/* CTA 2: ir para cadastro */}
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Começar agora <TrialDaysLabel />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded bg-gray-50 border">
              <div className="text-xs text-gray-500">Plano</div>
              <div className="text-lg font-semibold">{planLabel || "—"}</div>
            </div>
            <div className="p-3 rounded bg-gray-50 border">
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-lg font-semibold">
                {sub.status || (sub.active ? "active" : "inactive")}
              </div>
            </div>
            <div className="p-3 rounded bg-gray-50 border">
              <div className="text-xs text-gray-500">Vencimento</div>
              <div className="text-lg font-semibold">
                {typeof daysLeft === "number" ? (
                  daysLeft >= 0 ? (
                    <>restam {daysLeft} dia{daysLeft === 1 ? "" : "s"}</>
                  ) : (
                    <span className="text-red-600">expirado</span>
                  )
                ) : sub?.end_date ? (
                  new Date(sub.end_date).toISOString().slice(0, 10)
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}



